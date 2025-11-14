// trackium-life.js - Trackium Life Mode System

class TrackiumLife {
  constructor(database, blockchain) {
    this.db = database;
    this.blockchain = blockchain;
    this.currentUser = null;
  }

  // ========== USER PROFILE ==========

  /**
   * Инициализировать/загрузить профиль пользователя
   */
  async initUserProfile(callback) {
    this.db.sql(`SELECT * FROM life_users LIMIT 1`, (res) => {
      if (res.rows && res.rows.length > 0) {
        this.currentUser = res.rows[0];
        callback(this.currentUser);
      } else {
        // Создать нового пользователя
        this.createNewUser((user) => {
          this.currentUser = user;
          callback(user);
        });
      }
    });
  }

  /**
   * Создать нового пользователя
   */
  createNewUser(callback) {
    const defaultUser = {
      username: 'Adventurer',
      level: 1,
      experience: 0,
      avatar: 'default',
      avatar_color: '#0066CC',
      total_goals: 0,
      completed_goals: 0,
      current_streak: 0,
      longest_streak: 0,
      total_rewards: 0,
      created_at: new Date().toISOString()
    };

    const query = `INSERT INTO life_users 
      (username, level, experience, avatar, avatar_color, total_goals, completed_goals, 
       current_streak, longest_streak, total_rewards, created_at)
      VALUES ('${defaultUser.username}', ${defaultUser.level}, ${defaultUser.experience}, 
              '${defaultUser.avatar}', '${defaultUser.avatar_color}', ${defaultUser.total_goals}, 
              ${defaultUser.completed_goals}, ${defaultUser.current_streak}, ${defaultUser.longest_streak}, 
              ${defaultUser.total_rewards}, '${defaultUser.created_at}')`;

    this.db.sql(query, (res) => {
      if (res.status) {
        defaultUser.id = res.response?.id || 1;
        callback(defaultUser);
      }
    });
  }

  /**
   * Обновить профиль пользователя
   */
  updateUserProfile(updates, callback) {
    const fields = Object.keys(updates)
      .map(key => `${key} = '${updates[key]}'`)
      .join(', ');

    this.db.sql(`UPDATE life_users SET ${fields} WHERE id = ${this.currentUser.id}`, (res) => {
      if (res.status) {
        this.currentUser = { ...this.currentUser, ...updates };
        callback(true);
      } else {
        callback(false);
      }
    });
  }

  /**
   * Добавить опыт и проверить повышение уровня
   */
  addExperience(amount, callback) {
    const newExp = this.currentUser.experience + amount;
    const expForNextLevel = this.getExpForLevel(this.currentUser.level + 1);

    if (newExp >= expForNextLevel) {
      // Повышение уровня!
      const newLevel = this.currentUser.level + 1;
      
      this.updateUserProfile({
        level: newLevel,
        experience: newExp - expForNextLevel
      }, (success) => {
        if (success) {
          // Создать NFT для нового уровня
          this.mintLevelNFT(newLevel, () => {
            callback({ levelUp: true, newLevel: newLevel });
          });
        }
      });
    } else {
      // Просто добавить опыт
      this.updateUserProfile({ experience: newExp }, (success) => {
        callback({ levelUp: false });
      });
    }
  }

  /**
   * Рассчитать опыт для уровня
   */
  getExpForLevel(level) {
    return Math.floor(100 * Math.pow(1.5, level - 1));
  }

  /**
   * Создать NFT для достижения уровня
   */
  async mintLevelNFT(level, callback) {
    try {
      console.log(`🎖️ Minting Level ${level} NFT...`);

      const tokenName = `Trackium Level ${level}`;
      const tokenData = {
        name: tokenName,
        description: `Achievement NFT for reaching Level ${level} in Trackium Life`,
        level: level,
        rarity: this.getLevelRarity(level),
        timestamp: Date.now()
      };

      // Создать токен в Minima
      MDS.cmd(`tokencreate name:"${JSON.stringify(tokenData)}" amount:1 decimals:0`, (res) => {
        if (res.status) {
          console.log('✅ Level NFT minted:', res.response.tokenid);
          
          // Сохранить в БД
          this.db.sql(`INSERT INTO life_achievements 
            (user_id, type, level, token_id, created_at) 
            VALUES (${this.currentUser.id}, 'level_up', ${level}, '${res.response.tokenid}', '${new Date().toISOString()}')`, () => {
            callback(res.response.tokenid);
          });
        } else {
          console.error('Failed to mint NFT:', res.error);
          callback(null);
        }
      });

    } catch (error) {
      console.error('Error minting NFT:', error);
      callback(null);
    }
  }

  /**
   * Определить редкость уровня
   */
  getLevelRarity(level) {
    if (level >= 100) return 'Legendary';
    if (level >= 50) return 'Epic';
    if (level >= 25) return 'Rare';
    if (level >= 10) return 'Uncommon';
    return 'Common';
  }

  // ========== GOALS MANAGEMENT ==========

  /**
   * Создать новую цель
   */
  createGoal(goalData, callback) {
    const goal = {
      user_id: this.currentUser.id,
      title: goalData.title,
      description: goalData.description || '',
      target_lat: goalData.latitude,
      target_lng: goalData.longitude,
      target_radius: goalData.radius || 100,
      reward_amount: this.calculateReward(goalData),
      category: goalData.category || 'general',
      repeat_type: goalData.repeatType || 'once', // once, daily, weekly
      status: 'active',
      created_at: new Date().toISOString()
    };

    const query = `INSERT INTO life_goals 
      (user_id, title, description, target_lat, target_lng, target_radius, 
       reward_amount, category, repeat_type, status, created_at)
      VALUES (${goal.user_id}, '${this.db._escape(goal.title)}', '${this.db._escape(goal.description)}', 
              ${goal.target_lat}, ${goal.target_lng}, ${goal.target_radius}, 
              ${goal.reward_amount}, '${goal.category}', '${goal.repeat_type}', 
              '${goal.status}', '${goal.created_at}')`;

    this.db.sql(query, (res) => {
      if (res.status) {
        goal.id = res.response?.id;
        
        // Обновить счетчик целей
        this.updateUserProfile({
          total_goals: this.currentUser.total_goals + 1
        }, () => {});
        
        callback(goal);
      } else {
        callback(null);
      }
    });
  }

  /**
   * Рассчитать награду за цель
   */
  calculateReward(goalData) {
    let baseReward = 10; // Базовая награда 10 Minima

    // Бонус за расстояние от дома
    if (goalData.distanceFromHome) {
      const distanceKm = goalData.distanceFromHome / 1000;
      baseReward += Math.floor(distanceKm * 2); // +2 Minima за каждый километр
    }

    // Бонус за категорию
    const categoryBonus = {
      'fitness': 5,
      'education': 10,
      'social': 3,
      'work': 2,
      'hobby': 4
    };
    baseReward += categoryBonus[goalData.category] || 0;

    return baseReward;
  }

  /**
   * Получить все активные цели
   */
  getActiveGoals(callback) {
    this.db.sql(`SELECT * FROM life_goals WHERE user_id = ${this.currentUser.id} AND status = 'active' ORDER BY created_at DESC`, (res) => {
      callback(res.rows || []);
    });
  }

  /**
   * Проверить выполнение цели
   */
  async checkGoalCompletion(goalId, currentLat, currentLng, callback) {
    // Получить цель
    this.db.sql(`SELECT * FROM life_goals WHERE id = ${goalId}`, (res) => {
      if (!res.rows || res.rows.length === 0) {
        callback({ success: false, reason: 'Goal not found' });
        return;
      }

      const goal = res.rows[0];

      // Проверить можно ли выполнить сегодня
      this.canCompleteToday(goalId, (canComplete) => {
        if (!canComplete) {
          callback({ success: false, reason: 'Already completed today' });
          return;
        }

        // Рассчитать расстояние
        const distance = this.calculateDistance(
          currentLat, currentLng,
          goal.target_lat, goal.target_lng
        );

        console.log(`📍 Distance to goal: ${distance}m (radius: ${goal.target_radius}m)`);

        if (distance <= goal.target_radius) {
          // Цель выполнена!
          this.completeGoal(goal, currentLat, currentLng, callback);
        } else {
          callback({
            success: false,
            reason: 'Too far from target',
            distance: distance,
            required: goal.target_radius
          });
        }
      });
    });
  }

  /**
   * Проверить можно ли выполнить цель сегодня
   */
  canCompleteToday(goalId, callback) {
    const today = new Date().toISOString().split('T')[0];
    
    this.db.sql(`SELECT * FROM life_completions 
      WHERE goal_id = ${goalId} 
      AND DATE(completed_at) = '${today}'`, (res) => {
      callback(!res.rows || res.rows.length === 0);
    });
  }

  /**
   * Выполнить цель
   */
  async completeGoal(goal, lat, lng, callback) {
    const completion = {
      user_id: this.currentUser.id,
      goal_id: goal.id,
      completed_lat: lat,
      completed_lng: lng,
      reward_earned: goal.reward_amount,
      completed_at: new Date().toISOString()
    };

    // Сохранить выполнение
    const query = `INSERT INTO life_completions 
      (user_id, goal_id, completed_lat, completed_lng, reward_earned, completed_at)
      VALUES (${completion.user_id}, ${completion.goal_id}, ${completion.completed_lat}, 
              ${completion.completed_lng}, ${completion.reward_earned}, '${completion.completed_at}')`;

    this.db.sql(query, async (res) => {
      if (res.status) {
        // Обновить streak
        await this.updateStreak();

        // Добавить опыт
        const expGained = Math.floor(goal.reward_amount * 10);
        this.addExperience(expGained, (levelResult) => {
          
          // Отправить награду
          this.sendReward(goal.reward_amount, (rewardResult) => {
            
            // Обновить счетчик выполненных целей
            this.updateUserProfile({
              completed_goals: this.currentUser.completed_goals + 1,
              total_rewards: this.currentUser.total_rewards + goal.reward_amount
            }, () => {});

            // Submit proof на блокчейн
            this.submitGoalProof(goal, lat, lng, () => {
              callback({
                success: true,
                reward: goal.reward_amount,
                experience: expGained,
                levelUp: levelResult.levelUp,
                newLevel: levelResult.newLevel
              });
            });
          });
        });

      } else {
        callback({ success: false, reason: 'Database error' });
      }
    });
  }

  /**
   * Обновить streak
   */
  async updateStreak() {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    this.db.sql(`SELECT * FROM life_completions 
      WHERE user_id = ${this.currentUser.id} 
      AND DATE(completed_at) = '${yesterday}'`, (res) => {
      
      let newStreak = 1;
      
      if (res.rows && res.rows.length > 0) {
        // Продолжить streak
        newStreak = this.currentUser.current_streak + 1;
      }

      const longestStreak = Math.max(newStreak, this.currentUser.longest_streak);

      this.updateUserProfile({
        current_streak: newStreak,
        longest_streak: longestStreak
      }, () => {});
    });
  }

  /**
   * Отправить награду пользователю
   */
  sendReward(amount, callback) {
    MDS.cmd("getaddress", (res) => {
      if (!res.status) {
        callback(false);
        return;
      }

      const userAddress = res.response.miniaddress;

      // Создать транзакцию награды
      MDS.cmd(`send address:${userAddress} amount:${amount}`, (sendRes) => {
        if (sendRes.status) {
          console.log(`💰 Sent ${amount} Minima reward`);
          callback(true);
        } else {
          console.error('Failed to send reward:', sendRes.error);
          callback(false);
        }
      });
    });
  }

  /**
   * Отправить proof выполнения цели на блокчейн
   */
  async submitGoalProof(goal, lat, lng, callback) {
    const proofData = {
      goalId: goal.id,
      goalTitle: goal.title,
      targetLat: goal.target_lat,
      targetLng: goal.target_lng,
      completedLat: lat,
      completedLng: lng,
      timestamp: Date.now()
    };

    if (this.blockchain) {
      const result = await this.blockchain.submitProofOfMovement(`goal_${goal.id}`, {
        latitude: lat,
        longitude: lng,
        altitude: 0,
        accuracy: 50,
        timestamp: new Date().toISOString()
      });

      if (result) {
        console.log('⛓️ Goal proof submitted to blockchain:', result.txid);
      }
    }

    callback();
  }

  /**
   * Рассчитать расстояние между точками (Haversine)
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // м
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.floor(R * c);
  }

  // ========== STATISTICS ==========

  /**
   * Получить статистику пользователя
   */
  getUserStatistics(callback) {
    const stats = {
      profile: this.currentUser,
      recentCompletions: [],
      goalsByCategory: {},
      weeklyProgress: []
    };

    // Получить последние выполнения
    this.db.sql(`SELECT lc.*, lg.title, lg.category 
      FROM life_completions lc 
      JOIN life_goals lg ON lc.goal_id = lg.id 
      WHERE lc.user_id = ${this.currentUser.id} 
      ORDER BY lc.completed_at DESC 
      LIMIT 10`, (res) => {
      
      stats.recentCompletions = res.rows || [];
      
      // Получить статистику по категориям
      this.db.sql(`SELECT lg.category, COUNT(*) as count, SUM(lc.reward_earned) as total_rewards
        FROM life_completions lc 
        JOIN life_goals lg ON lc.goal_id = lg.id 
        WHERE lc.user_id = ${this.currentUser.id} 
        GROUP BY lg.category`, (res2) => {
        
        (res2.rows || []).forEach(row => {
          stats.goalsByCategory[row.category] = {
            count: row.count,
            totalRewards: row.total_rewards
          };
        });

        callback(stats);
      });
    });
  }
}

window.TrackiumLife = TrackiumLife;
console.log('✅ trackium-life.js loaded');
