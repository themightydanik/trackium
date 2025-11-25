// contracts.js - Trackium Smart Contracts

class TrackiumContracts {
  
  // Proof-of-Movement Contract
  static getProofOfMovementScript() {
    return `
      LET deviceId = STATE(0)
      LET movementHash = STATE(1)
      LET timestamp = STATE(2)
      LET ownerKey = STATE(3)
      
      IF SIGNEDBY(ownerKey) THEN 
        RETURN TRUE 
      ENDIF
      
      IF @COINAGE GT 0 THEN
        ASSERT SAMESTATE(0 2)
        RETURN TRUE
      ENDIF
      
      RETURN FALSE
    `;
  }

  // Smart Lock Contract
  static getSmartLockScript() {
    return `
      LET deviceId = STATE(0)
      LET lockStatus = STATE(1)
      LET ownerKey = STATE(2)
      LET unlockHash = STATE(3)
      
      IF SIGNEDBY(ownerKey) THEN 
        RETURN TRUE 
      ENDIF
      
      IF lockStatus EQ TRUE AND SHA3(STATE(4)) EQ unlockHash THEN
        ASSERT STATE(1) EQ FALSE
        RETURN TRUE
      ENDIF
      
      IF @COINAGE GT 288 THEN
        RETURN TRUE
      ENDIF
      
      RETURN FALSE
    `;
  }

  // Shipment Delivery Contract
  static getDeliveryScript() {
    return `
      LET shipmentId = STATE(0)
      LET recipientKey = STATE(1)
      LET senderKey = STATE(2)
      LET destinationHash = STATE(3)
      
      IF SIGNEDBY(senderKey) AND @COINAGE LT 10 THEN
        RETURN TRUE
      ENDIF
      
      IF SIGNEDBY(recipientKey) AND SHA3(STATE(4)) EQ destinationHash THEN
        RETURN TRUE
      ENDIF
      
      IF @COINAGE GT 43200 AND SIGNEDBY(senderKey) THEN
        RETURN TRUE
      ENDIF
      
      RETURN FALSE
    `;
  }

  // Time-locked Escrow Contract (для платежей)
  static getEscrowScript() {
    return `
      LET buyerKey = STATE(0)
      LET sellerKey = STATE(1)
      LET arbiterKey = STATE(2)
      LET escrowAmount = STATE(3)
      LET releaseTime = STATE(4)
      
      IF SIGNEDBY(buyerKey) AND SIGNEDBY(sellerKey) THEN
        RETURN TRUE
      ENDIF
      
      IF @BLOCK GT releaseTime AND SIGNEDBY(sellerKey) THEN
        RETURN TRUE
      ENDIF
      
      IF SIGNEDBY(arbiterKey) THEN
        RETURN TRUE
      ENDIF
      
      RETURN FALSE
    `;
  }

  // Multi-Device Tracking Contract (для группы устройств)
  static getMultiDeviceScript() {
    return `
      LET device1 = STATE(0)
      LET device2 = STATE(1)
      LET device3 = STATE(2)
      LET ownerKey = STATE(3)
      LET requiredDevices = STATE(4)
      
      IF SIGNEDBY(ownerKey) THEN
        RETURN TRUE
      ENDIF
      
      LET verified = 0
      
      IF SIGNEDBY(device1) THEN
        LET verified = INC(verified)
      ENDIF
      
      IF SIGNEDBY(device2) THEN
        LET verified = INC(verified)
      ENDIF
      
      IF SIGNEDBY(device3) THEN
        LET verified = INC(verified)
      ENDIF
      
      RETURN verified GTE requiredDevices
    `;
  }

  // Conditional Release Contract (с условиями)
  static getConditionalReleaseScript() {
    return `
      LET ownerKey = STATE(0)
      LET conditionHash = STATE(1)
      LET minTime = STATE(2)
      
      IF SIGNEDBY(ownerKey) AND @BLOCK GT minTime THEN
        RETURN TRUE
      ENDIF
      
      IF SHA3(STATE(3)) EQ conditionHash THEN
        RETURN TRUE
      ENDIF
      
      RETURN FALSE
    `;
  }
}

globalThis.TrackiumContracts = TrackiumContracts;
