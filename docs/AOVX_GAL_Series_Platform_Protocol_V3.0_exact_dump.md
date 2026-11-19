# Точная выгрузка Excel: `AOVX_GAL_Series_Platform_Protocol_V3.0.xlsx`

Выгрузка без пересказа и без исправлений исходного текста. Правила записи:

- Каждый лист — отдельные TSV-блоки. Первая колонка каждого блока — номер строки Excel (`row`), строка заголовка блока — буквы столбцов Excel. Эти две служебные строки/колонка не являются данными листа.
- Пустая ячейка = пустое поле. Пустые строки сохранены (в них только номер строки).
- Переводы строк внутри ячейки записаны как `\n`, табуляция как `\t`, обратный слэш как `\\`. Ведущие/замыкающие пробелы сохранены как есть.
- Значения записаны так, как хранятся в файле: числа (int) — десятичной записью, остальное — строки (`0x7E`, `1F`, `0X10` и т.п. не нормализованы).
- Широкие листы разбиты на последовательные части по столбцам (не более 64 столбцов на часть); диапазон каждой части указан.

## 1. Структура книги

Порядок листов в книге (как в `xl/workbook.xml`):

| # | Лист | Видимость | Объявленный диапазон (dimension) | Фактический диапазон данных | Строк с данными | Непустых ячеек | Объединённых диапазонов |
|---|---|---|---|---|---|---|---|
| 1 | `summary` | visible | A1:XFD24 | A1:E24 | 20 | 44 | 766 |
| 2 | `0x0100` | hidden | A1:BI29 | B1:BB20 | 15 | 150 | 28 |
| 3 | `0x0102` | hidden | A1:AC36 | B1:AB20 | 13 | 80 | 18 |
| 4 | `0x0001` | visible | A1:X37 | B1:U22 | 17 | 77 | 24 |
| 5 | `0x0104` | visible | A1:AJ38 | B1:AB22 | 15 | 91 | 26 |
| 6 | `0x0200` | visible | A1:IJ58 | A1:II53 | 42 | 697 | 176 |
| 7 | `0x0900` | visible | A1:GL49 | B1:AV37 | 27 | 156 | 47 |
| 8 | `0x8001` | visible | A1:X31 | B1:U22 | 14 | 74 | 25 |
| 9 | `0x8100` | hidden | A1:AH29 | B1:AE20 | 15 | 96 | 19 |
| 10 | `0x8103` | visible | A1:BW79 | B1:AA78 | 68 | 426 | 392 |
| 11 | `0x8104` | visible | A1:XFC34 | B1:P22 | 13 | 54 | 19 |
| 12 | `0x8900` | hidden | A1:XEY36 | B1:R22 | 15 | 64 | 16 |
| 13 | `0x8A00` | hidden | A1:AC29 | B1:T20 | 12 | 61 | 24 |

Комментарии/примечания к ячейкам: **отсутствуют** ни на одном листе.
Формулы: **отсутствуют** (все ячейки — константы). Определённые имена (defined names): нет. Проверка данных (data validation), диаграммы: нет.
Рисунки: 1 изображение (PNG) на листе `summary`, привязка от A1 (смещение) до C2 — логотип «AOVX» (в метаданных: `descr="image028(09-28-09-44-23)"`, имя `图片 1`). Текстом не представимо.
Гиперссылки: на каждом из 12 листов сообщений ячейка `B1` (текст `Back to summary`) → `summary!A1`; ячейка `F1` (текст `Introduction!A1`) → `Introduction!A1` (листа с таким именем в книге нет — приведено как в файле, не исправлено). На листе `summary` гиперссылок нет.
Rich text: в общих строках файла есть 54 фрагмента форматированного текста (часть ячеек содержит разное форматирование внутри). Текст сохранён целиком, форматирование (цвет/жирность отдельных фрагментов) не передаётся.
Свойства документа: creator `tommy`; lastModifiedBy `Saya-张桂霞`; created 2021-09-28T01:37:00Z; modified 2026-10-10T07:14:03Z.

### Скрытые строки и столбцы

- `summary`: скрытые строки: [14]; скрытые столбцы: нет
- `0x0900`: скрытые строки: нет; скрытые столбцы: ['AN:AS']
- `0x8103`: скрытые строки: [38, 51, 52]; скрытые столбцы: нет

## 2. Содержимое листов

### 2.1. Лист `summary`

- Статус: **visible**
- Объявленный диапазон: `A1:XFD24`; фактические данные: `A1:E24`
- Исходные заголовки: A5:D5 (Message ID | Description | Server Response), A12:D12 (Message ID | Description | Device Response), A19:E19 (Flag | Message Header | Message Body | Checksum Code | Flag)
- Объединённые ячейки: всего 766; с текстом/значением в левой верхней ячейке — 19; без значения (только оформление) — 747.
- Скрытые строки: [14]; скрытые столбцы: нет. Непустые ячейки в них (выгружены ниже наравне с остальными): A14, C14, D14

Объединённые диапазоны со значением (значение принадлежит всему диапазону; сама ячейка — левая верхняя):

```tsv
range	value
C1:V2	AOVX Cloud Platform Protocol _V3.0_2025.03.05
A4:V4	Message from device to cloud server
A5:B5	Message ID
A6:B6	0x0001
A7:B7	0x0104
A8:B8	0x0200
A9:B9	0x0900
A11:V11	Message from cloud server to device
A12:B12	Message ID
A13:B13	0x8001
A14:B14	0x8100
A15:B15	0x8103
A16:B16	0x8104
A18:B18	Remarks:
A20:XFD20	1. The message is consisted of flag, message header, message body, checksum code and flag.  For detailed message description refer to the detailed format of the message.
A21:XFD21	2. The start/end flag is 0x7E. If 0x7E and 0x7D exist in the checksum, message header or message body, it must be transferred in meaning. The transferred meaning rules are as below: [0x7E] -> [0x7D 0x02]    [0x7D] -> [0x7D 0x01]
A22:XFD22	3. Send message: pack message ——> calculate and fill the checksum ——> transferred meaning
A23:XFD23	4. Receive message: transferred meaning ——> verify checksum code ——> parse message
A24:XFD24	5. "*" indicates that this function is not supported.
```

Объединённые диапазоны без значения:

```
A1:B2, A3:XFD3, A10:XFD10, W11:AR11, AS11:BN11, BO11:CJ11, CK11:DF11, DG11:EB11, EC11:EX11, EY11:FT11, FU11:GP11, GQ11:HL11, HM11:IH11, II11:JD11, JE11:JZ11, KA11:KV11, KW11:LR11, LS11:MN11, MO11:NJ11, NK11:OF11, OG11:PB11, PC11:PX11, PY11:QT11, QU11:RP11, RQ11:SL11, SM11:TH11, TI11:UD11, UE11:UZ11, VA11:VV11, VW11:WR11, WS11:XN11, XO11:YJ11, YK11:ZF11, ZG11:AAB11, AAC11:AAX11, AAY11:ABT11, ABU11:ACP11, ACQ11:ADL11, ADM11:AEH11, AEI11:AFD11, AFE11:AFZ11, AGA11:AGV11, AGW11:AHR11, AHS11:AIN11, AIO11:AJJ11, AJK11:AKF11, AKG11:ALB11, ALC11:ALX11, ALY11:AMT11, AMU11:ANP11, ANQ11:AOL11, AOM11:APH11, API11:AQD11, AQE11:AQZ11, ARA11:ARV11, ARW11:ASR11, ASS11:ATN11, ATO11:AUJ11, AUK11:AVF11, AVG11:AWB11, AWC11:AWX11, AWY11:AXT11, AXU11:AYP11, AYQ11:AZL11, AZM11:BAH11, BAI11:BBD11, BBE11:BBZ11, BCA11:BCV11, BCW11:BDR11, BDS11:BEN11, BEO11:BFJ11, BFK11:BGF11, BGG11:BHB11, BHC11:BHX11, BHY11:BIT11, BIU11:BJP11, BJQ11:BKL11, BKM11:BLH11, BLI11:BMD11, BME11:BMZ11, BNA11:BNV11, BNW11:BOR11, BOS11:BPN11, BPO11:BQJ11, BQK11:BRF11, BRG11:BSB11, BSC11:BSX11, BSY11:BTT11, BTU11:BUP11, BUQ11:BVL11, BVM11:BWH11, BWI11:BXD11, BXE11:BXZ11, BYA11:BYV11, BYW11:BZR11, BZS11:CAN11, CAO11:CBJ11, CBK11:CCF11, CCG11:CDB11, CDC11:CDX11, CDY11:CET11, CEU11:CFP11, CFQ11:CGL11, CGM11:CHH11, CHI11:CID11, CIE11:CIZ11, CJA11:CJV11, CJW11:CKR11, CKS11:CLN11, CLO11:CMJ11, CMK11:CNF11, CNG11:COB11, COC11:COX11, COY11:CPT11, CPU11:CQP11, CQQ11:CRL11, CRM11:CSH11, CSI11:CTD11, CTE11:CTZ11, CUA11:CUV11, CUW11:CVR11, CVS11:CWN11, CWO11:CXJ11, CXK11:CYF11, CYG11:CZB11, CZC11:CZX11, CZY11:DAT11, DAU11:DBP11, DBQ11:DCL11, DCM11:DDH11, DDI11:DED11, DEE11:DEZ11, DFA11:DFV11, DFW11:DGR11, DGS11:DHN11, DHO11:DIJ11, DIK11:DJF11, DJG11:DKB11, DKC11:DKX11, DKY11:DLT11, DLU11:DMP11, DMQ11:DNL11, DNM11:DOH11, DOI11:DPD11, DPE11:DPZ11, DQA11:DQV11, DQW11:DRR11, DRS11:DSN11, DSO11:DTJ11, DTK11:DUF11, DUG11:DVB11, DVC11:DVX11, DVY11:DWT11, DWU11:DXP11, DXQ11:DYL11, DYM11:DZH11, DZI11:EAD11, EAE11:EAZ11, EBA11:EBV11, EBW11:ECR11, ECS11:EDN11, EDO11:EEJ11, EEK11:EFF11, EFG11:EGB11, EGC11:EGX11, EGY11:EHT11, EHU11:EIP11, EIQ11:EJL11, EJM11:EKH11, EKI11:ELD11, ELE11:ELZ11, EMA11:EMV11, EMW11:ENR11, ENS11:EON11, EOO11:EPJ11, EPK11:EQF11, EQG11:ERB11, ERC11:ERX11, ERY11:EST11, ESU11:ETP11, ETQ11:EUL11, EUM11:EVH11, EVI11:EWD11, EWE11:EWZ11, EXA11:EXV11, EXW11:EYR11, EYS11:EZN11, EZO11:FAJ11, FAK11:FBF11, FBG11:FCB11, FCC11:FCX11, FCY11:FDT11, FDU11:FEP11, FEQ11:FFL11, FFM11:FGH11, FGI11:FHD11, FHE11:FHZ11, FIA11:FIV11, FIW11:FJR11, FJS11:FKN11, FKO11:FLJ11, FLK11:FMF11, FMG11:FNB11, FNC11:FNX11, FNY11:FOT11, FOU11:FPP11, FPQ11:FQL11, FQM11:FRH11, FRI11:FSD11, FSE11:FSZ11, FTA11:FTV11, FTW11:FUR11, FUS11:FVN11, FVO11:FWJ11, FWK11:FXF11, FXG11:FYB11, FYC11:FYX11, FYY11:FZT11, FZU11:GAP11, GAQ11:GBL11, GBM11:GCH11, GCI11:GDD11, GDE11:GDZ11, GEA11:GEV11, GEW11:GFR11, GFS11:GGN11, GGO11:GHJ11, GHK11:GIF11, GIG11:GJB11, GJC11:GJX11, GJY11:GKT11, GKU11:GLP11, GLQ11:GML11, GMM11:GNH11, GNI11:GOD11, GOE11:GOZ11, GPA11:GPV11, GPW11:GQR11, GQS11:GRN11, GRO11:GSJ11, GSK11:GTF11, GTG11:GUB11, GUC11:GUX11, GUY11:GVT11, GVU11:GWP11, GWQ11:GXL11, GXM11:GYH11, GYI11:GZD11, GZE11:GZZ11, HAA11:HAV11, HAW11:HBR11, HBS11:HCN11, HCO11:HDJ11, HDK11:HEF11, HEG11:HFB11, HFC11:HFX11, HFY11:HGT11, HGU11:HHP11, HHQ11:HIL11, HIM11:HJH11, HJI11:HKD11, HKE11:HKZ11, HLA11:HLV11, HLW11:HMR11, HMS11:HNN11, HNO11:HOJ11, HOK11:HPF11, HPG11:HQB11, HQC11:HQX11, HQY11:HRT11, HRU11:HSP11, HSQ11:HTL11, HTM11:HUH11, HUI11:HVD11, HVE11:HVZ11, HWA11:HWV11, HWW11:HXR11, HXS11:HYN11, HYO11:HZJ11, HZK11:IAF11, IAG11:IBB11, IBC11:IBX11, IBY11:ICT11, ICU11:IDP11, IDQ11:IEL11, IEM11:IFH11, IFI11:IGD11, IGE11:IGZ11, IHA11:IHV11, IHW11:IIR11, IIS11:IJN11, IJO11:IKJ11, IKK11:ILF11, ILG11:IMB11, IMC11:IMX11, IMY11:INT11, INU11:IOP11, IOQ11:IPL11, IPM11:IQH11, IQI11:IRD11, IRE11:IRZ11, ISA11:ISV11, ISW11:ITR11, ITS11:IUN11, IUO11:IVJ11, IVK11:IWF11, IWG11:IXB11, IXC11:IXX11, IXY11:IYT11, IYU11:IZP11, IZQ11:JAL11, JAM11:JBH11, JBI11:JCD11, JCE11:JCZ11, JDA11:JDV11, JDW11:JER11, JES11:JFN11, JFO11:JGJ11, JGK11:JHF11, JHG11:JIB11, JIC11:JIX11, JIY11:JJT11, JJU11:JKP11, JKQ11:JLL11, JLM11:JMH11, JMI11:JND11, JNE11:JNZ11, JOA11:JOV11, JOW11:JPR11, JPS11:JQN11, JQO11:JRJ11, JRK11:JSF11, JSG11:JTB11, JTC11:JTX11, JTY11:JUT11, JUU11:JVP11, JVQ11:JWL11, JWM11:JXH11, JXI11:JYD11, JYE11:JYZ11, JZA11:JZV11, JZW11:KAR11, KAS11:KBN11, KBO11:KCJ11, KCK11:KDF11, KDG11:KEB11, KEC11:KEX11, KEY11:KFT11, KFU11:KGP11, KGQ11:KHL11, KHM11:KIH11, KII11:KJD11, KJE11:KJZ11, KKA11:KKV11, KKW11:KLR11, KLS11:KMN11, KMO11:KNJ11, KNK11:KOF11, KOG11:KPB11, KPC11:KPX11, KPY11:KQT11, KQU11:KRP11, KRQ11:KSL11, KSM11:KTH11, KTI11:KUD11, KUE11:KUZ11, KVA11:KVV11, KVW11:KWR11, KWS11:KXN11, KXO11:KYJ11, KYK11:KZF11, KZG11:LAB11, LAC11:LAX11, LAY11:LBT11, LBU11:LCP11, LCQ11:LDL11, LDM11:LEH11, LEI11:LFD11, LFE11:LFZ11, LGA11:LGV11, LGW11:LHR11, LHS11:LIN11, LIO11:LJJ11, LJK11:LKF11, LKG11:LLB11, LLC11:LLX11, LLY11:LMT11, LMU11:LNP11, LNQ11:LOL11, LOM11:LPH11, LPI11:LQD11, LQE11:LQZ11, LRA11:LRV11, LRW11:LSR11, LSS11:LTN11, LTO11:LUJ11, LUK11:LVF11, LVG11:LWB11, LWC11:LWX11, LWY11:LXT11, LXU11:LYP11, LYQ11:LZL11, LZM11:MAH11, MAI11:MBD11, MBE11:MBZ11, MCA11:MCV11, MCW11:MDR11, MDS11:MEN11, MEO11:MFJ11, MFK11:MGF11, MGG11:MHB11, MHC11:MHX11, MHY11:MIT11, MIU11:MJP11, MJQ11:MKL11, MKM11:MLH11, MLI11:MMD11, MME11:MMZ11, MNA11:MNV11, MNW11:MOR11, MOS11:MPN11, MPO11:MQJ11, MQK11:MRF11, MRG11:MSB11, MSC11:MSX11, MSY11:MTT11, MTU11:MUP11, MUQ11:MVL11, MVM11:MWH11, MWI11:MXD11, MXE11:MXZ11, MYA11:MYV11, MYW11:MZR11, MZS11:NAN11, NAO11:NBJ11, NBK11:NCF11, NCG11:NDB11, NDC11:NDX11, NDY11:NET11, NEU11:NFP11, NFQ11:NGL11, NGM11:NHH11, NHI11:NID11, NIE11:NIZ11, NJA11:NJV11, NJW11:NKR11, NKS11:NLN11, NLO11:NMJ11, NMK11:NNF11, NNG11:NOB11, NOC11:NOX11, NOY11:NPT11, NPU11:NQP11, NQQ11:NRL11, NRM11:NSH11, NSI11:NTD11, NTE11:NTZ11, NUA11:NUV11, NUW11:NVR11, NVS11:NWN11, NWO11:NXJ11, NXK11:NYF11, NYG11:NZB11, NZC11:NZX11, NZY11:OAT11, OAU11:OBP11, OBQ11:OCL11, OCM11:ODH11, ODI11:OED11, OEE11:OEZ11, OFA11:OFV11, OFW11:OGR11, OGS11:OHN11, OHO11:OIJ11, OIK11:OJF11, OJG11:OKB11, OKC11:OKX11, OKY11:OLT11, OLU11:OMP11, OMQ11:ONL11, ONM11:OOH11, OOI11:OPD11, OPE11:OPZ11, OQA11:OQV11, OQW11:ORR11, ORS11:OSN11, OSO11:OTJ11, OTK11:OUF11, OUG11:OVB11, OVC11:OVX11, OVY11:OWT11, OWU11:OXP11, OXQ11:OYL11, OYM11:OZH11, OZI11:PAD11, PAE11:PAZ11, PBA11:PBV11, PBW11:PCR11, PCS11:PDN11, PDO11:PEJ11, PEK11:PFF11, PFG11:PGB11, PGC11:PGX11, PGY11:PHT11, PHU11:PIP11, PIQ11:PJL11, PJM11:PKH11, PKI11:PLD11, PLE11:PLZ11, PMA11:PMV11, PMW11:PNR11, PNS11:PON11, POO11:PPJ11, PPK11:PQF11, PQG11:PRB11, PRC11:PRX11, PRY11:PST11, PSU11:PTP11, PTQ11:PUL11, PUM11:PVH11, PVI11:PWD11, PWE11:PWZ11, PXA11:PXV11, PXW11:PYR11, PYS11:PZN11, PZO11:QAJ11, QAK11:QBF11, QBG11:QCB11, QCC11:QCX11, QCY11:QDT11, QDU11:QEP11, QEQ11:QFL11, QFM11:QGH11, QGI11:QHD11, QHE11:QHZ11, QIA11:QIV11, QIW11:QJR11, QJS11:QKN11, QKO11:QLJ11, QLK11:QMF11, QMG11:QNB11, QNC11:QNX11, QNY11:QOT11, QOU11:QPP11, QPQ11:QQL11, QQM11:QRH11, QRI11:QSD11, QSE11:QSZ11, QTA11:QTV11, QTW11:QUR11, QUS11:QVN11, QVO11:QWJ11, QWK11:QXF11, QXG11:QYB11, QYC11:QYX11, QYY11:QZT11, QZU11:RAP11, RAQ11:RBL11, RBM11:RCH11, RCI11:RDD11, RDE11:RDZ11, REA11:REV11, REW11:RFR11, RFS11:RGN11, RGO11:RHJ11, RHK11:RIF11, RIG11:RJB11, RJC11:RJX11, RJY11:RKT11, RKU11:RLP11, RLQ11:RML11, RMM11:RNH11, RNI11:ROD11, ROE11:ROZ11, RPA11:RPV11, RPW11:RQR11, RQS11:RRN11, RRO11:RSJ11, RSK11:RTF11, RTG11:RUB11, RUC11:RUX11, RUY11:RVT11, RVU11:RWP11, RWQ11:RXL11, RXM11:RYH11, RYI11:RZD11, RZE11:RZZ11, SAA11:SAV11, SAW11:SBR11, SBS11:SCN11, SCO11:SDJ11, SDK11:SEF11, SEG11:SFB11, SFC11:SFX11, SFY11:SGT11, SGU11:SHP11, SHQ11:SIL11, SIM11:SJH11, SJI11:SKD11, SKE11:SKZ11, SLA11:SLV11, SLW11:SMR11, SMS11:SNN11, SNO11:SOJ11, SOK11:SPF11, SPG11:SQB11, SQC11:SQX11, SQY11:SRT11, SRU11:SSP11, SSQ11:STL11, STM11:SUH11, SUI11:SVD11, SVE11:SVZ11, SWA11:SWV11, SWW11:SXR11, SXS11:SYN11, SYO11:SZJ11, SZK11:TAF11, TAG11:TBB11, TBC11:TBX11, TBY11:TCT11, TCU11:TDP11, TDQ11:TEL11, TEM11:TFH11, TFI11:TGD11, TGE11:TGZ11, THA11:THV11, THW11:TIR11, TIS11:TJN11, TJO11:TKJ11, TKK11:TLF11, TLG11:TMB11, TMC11:TMX11, TMY11:TNT11, TNU11:TOP11, TOQ11:TPL11, TPM11:TQH11, TQI11:TRD11, TRE11:TRZ11, TSA11:TSV11, TSW11:TTR11, TTS11:TUN11, TUO11:TVJ11, TVK11:TWF11, TWG11:TXB11, TXC11:TXX11, TXY11:TYT11, TYU11:TZP11, TZQ11:UAL11, UAM11:UBH11, UBI11:UCD11, UCE11:UCZ11, UDA11:UDV11, UDW11:UER11, UES11:UFN11, UFO11:UGJ11, UGK11:UHF11, UHG11:UIB11, UIC11:UIX11, UIY11:UJT11, UJU11:UKP11, UKQ11:ULL11, ULM11:UMH11, UMI11:UND11, UNE11:UNZ11, UOA11:UOV11, UOW11:UPR11, UPS11:UQN11, UQO11:URJ11, URK11:USF11, USG11:UTB11, UTC11:UTX11, UTY11:UUT11, UUU11:UVP11, UVQ11:UWL11, UWM11:UXH11, UXI11:UYD11, UYE11:UYZ11, UZA11:UZV11, UZW11:VAR11, VAS11:VBN11, VBO11:VCJ11, VCK11:VDF11, VDG11:VEB11, VEC11:VEX11, VEY11:VFT11, VFU11:VGP11, VGQ11:VHL11, VHM11:VIH11, VII11:VJD11, VJE11:VJZ11, VKA11:VKV11, VKW11:VLR11, VLS11:VMN11, VMO11:VNJ11, VNK11:VOF11, VOG11:VPB11, VPC11:VPX11, VPY11:VQT11, VQU11:VRP11, VRQ11:VSL11, VSM11:VTH11, VTI11:VUD11, VUE11:VUZ11, VVA11:VVV11, VVW11:VWR11, VWS11:VXN11, VXO11:VYJ11, VYK11:VZF11, VZG11:WAB11, WAC11:WAX11, WAY11:WBT11, WBU11:WCP11, WCQ11:WDL11, WDM11:WEH11, WEI11:WFD11, WFE11:WFZ11, WGA11:WGV11, WGW11:WHR11, WHS11:WIN11, WIO11:WJJ11, WJK11:WKF11, WKG11:WLB11, WLC11:WLX11, WLY11:WMT11, WMU11:WNP11, WNQ11:WOL11, WOM11:WPH11, WPI11:WQD11, WQE11:WQZ11, WRA11:WRV11, WRW11:WSR11, WSS11:WTN11, WTO11:WUJ11, WUK11:WVF11, WVG11:WWB11, WWC11:WWX11, WWY11:WXT11, WXU11:WYP11, WYQ11:WZL11, WZM11:XAH11, XAI11:XBD11, XBE11:XBZ11, XCA11:XCV11, XCW11:XDR11, XDS11:XEN11, XEO11:XFD11
```

**Часть 1/1 — диапазон `A1:E24`**

```tsv
row	A	B	C	D	E
1			AOVX Cloud Platform Protocol _V3.0_2025.03.05		
2					
3					
4	Message from device to cloud server				
5	Message ID		Description	Server  Response	
6	0x0001		Device General Query Response;  The device sends 0x0001 to respond the query command 0x8103 from server. 	\\	
7	0x0104		Device Genernal Configuration Response; The device sends 0x0104 to respond the configuration commmand 0x8104 from server.	\\	
8	0x0200		Device Basic Information; Contains location information, Device ID, Cell ID, WiFi info and internal sensor data.	0x8001	
9	0x0900		Device Additional Information; Contains data from external sensors.	0x8001	
10					
11	Message from cloud server to device				
12	Message ID		Description	Device Response	
13	0x8001		Server General Response;  Server sends 0x8001 to respond the message (0x0200, 0x0900) from the device. 	\\	
14	0x8100		Device Registration Response	\\	
15	0x8103		Configuration Commands; Server sends commands to configure the device.	0x0001	
16	0x8104		Query Commands; Server sends commands to query the parameters of device.	0x0104	
17					
18	Remarks:				
19	Flag	Message Header	Message Body	Checksum Code 	Flag
20	1. The message is consisted of flag, message header, message body, checksum code and flag.  For detailed message description refer to the detailed format of the message.				
21	2. The start/end flag is 0x7E. If 0x7E and 0x7D exist in the checksum, message header or message body, it must be transferred in meaning. The transferred meaning rules are as below: [0x7E] -> [0x7D 0x02]    [0x7D] -> [0x7D 0x01]				
22	3. Send message: pack message ——> calculate and fill the checksum ——> transferred meaning				
23	4. Receive message: transferred meaning ——> verify checksum code ——> parse message				
24	5. "*" indicates that this function is not supported.				
```

**Проверка листа:**

- Непустых строк: 20
- Непустых ячеек в исходнике: 44; выгружено в TSV: 44 → совпадает, содержимое извлечено полностью
- Из них числовых (int) ячеек: 0; остальные — строки
- Не представимо текстом корректно: логотип-изображение (A1:C2); оформление ячеек (заливка, границы, шрифты) и rich-text внутри ячеек не передаются; раскладка ячеек на сетке (позиции полей по столбцам) сохранена только через координаты

### 2.2. Лист `0x0100`

- Статус: **hidden**
- Объявленный диапазон: `A1:BI29`; фактические данные: `B1:BB20`
- Исходные заголовки: строки 3 (названия полей), 4 (тип/размер), 5 (номера байтов)
- Объединённые ячейки: всего 28; с текстом/значением в левой верхней ячейке — 27; без значения (только оформление) — 1.
- Скрытых строк и столбцов нет.

Объединённые диапазоны со значением (значение принадлежит всему диапазону; сама ячейка — левая верхняя):

```tsv
range	value
B1:E1	Back to summary
C3:D3	Message ID
E3:F3	Properties of \nMessage\n Body
G3:L3	Device ID
M3:N3	Message Sequence Number
O3:P3	Province Area\nID
Q3:R3	District ID 
S3:W3	Manufacturer\nID
X3:AQ3	Device Type
AR3:AX3	Terminal ID
C4:D4	HEX\n(2 bytes)
E4:F4	HEX\n(2 bytes)
G4:L4	HEX\n(6 bytes)
M4:N4	HEX\n(2 bytes)
O4:P4	HEX\n(2 bytes)
Q4:R4	HEX\n(2 bytes)
S4:W4	HEX\n(5 bytes)
X4:AQ4	HEX\n(20 bytes)
AR4:AX4	HEX\n(7 bytes)
G8:L12	If the device number is not configured:\nit takes the last 12 digits of IMEI number and converts it into BCD code
S10:V10	Default is AOVX
X10:AA10	Default is 0
AR10:AU10	Default is 0
E16:I16	Bit 15: sub-package,reserved, default is 0
E17:L17	Bit14: this bit is reserved as 0 by default
E18:I18	Bit 13: sub-package,reserved, default is 0
E19:I19	Bit 12-10: encryption, reserved, default is 0
```

Объединённые диапазоны без значения:

```
J16:L16
```

**Часть 1/1 — диапазон `B1:BB20`**

```tsv
row	B	C	D	E	F	G	H	I	J	K	L	M	N	O	P	Q	R	S	T	U	V	W	X	Y	Z	AA	AB	AC	AD	AE	AF	AG	AH	AI	AJ	AK	AL	AM	AN	AO	AP	AQ	AR	AS	AT	AU	AV	AW	AX	AY	AZ	BA	BB
1	Back to summary				Introduction!A1																																																
2	Device Registration (0x0100)																																																				
3	Flag	Message ID		Properties of \nMessage\n Body		Device ID						Message Sequence Number		Province Area\nID		District ID 		Manufacturer\nID					Device Type																				Terminal ID							License Plate\nColor	Vehicle Logo	Checksum Code	Flag
4	HEX\n(1 byte)	HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(5 bytes)					HEX\n(20 bytes)																				HEX\n(7 bytes)							HEX\n(1 byte)	HEX\n(1 byte)	HEX\n(1 byte)	HEX\n(1 byte)
5	1	2	3	4	5	6	7	8	9	10	11	12	13	14	15	16	17	18	19	20	21	22	23	24	25	26	27	28	29	30	31	32	33	34	35	36	37	38	39	40	41	42	43	44	45	46	47	48	49	50	51	52	53
6	0x7E	0x01	0x00	0x00	0x26	0x22	0x10	0x42	0x21	0x43	0x28	0x00	0x01	0x00	0x00	0x00	0x00	0x41	0x4F	0x56	0x58	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x48	0x7E
7																																																					
8						If the device number is not configured:\nit takes the last 12 digits of IMEI number and converts it into BCD code																																															
9																																																					
10																		Default is AOVX					Default is 0																				Default is 0								Default is 0		
11																																																					
12																Reserved, default is 0																																		Default is 0			
13																																																					
14														Reserved, default is 0																																							
15																																																					
16				Bit 15: sub-package,reserved, default is 0																																																	
17				Bit14: this bit is reserved as 0 by default																																																	
18				Bit 13: sub-package,reserved, default is 0																																																	
19				Bit 12-10: encryption, reserved, default is 0																																																	
20				Bit 9-0: length of message body																																																	
```

**Проверка листа:**

- Непустых строк: 15
- Непустых ячеек в исходнике: 150; выгружено в TSV: 150 → совпадает, содержимое извлечено полностью
- Из них числовых (int) ячеек: 53; остальные — строки
- Не представимо текстом корректно: оформление ячеек (заливка, границы, шрифты) и rich-text внутри ячеек не передаются; гиперссылки B1→summary!A1 и F1→Introduction!A1 (адрес ссылки не виден в тексте ячейки); раскладка ячеек на сетке (позиции полей по столбцам) сохранена только через координаты

### 2.3. Лист `0x0102`

- Статус: **hidden**
- Объявленный диапазон: `A1:AC36`; фактические данные: `B1:AB20`
- Исходные заголовки: строки 3, 4, 5
- Объединённые ячейки: всего 18; с текстом/значением в левой верхней ячейке — 17; без значения (только оформление) — 1.
- Скрытых строк и столбцов нет.

Объединённые диапазоны со значением (значение принадлежит всему диапазону; сама ячейка — левая верхняя):

```tsv
range	value
B1:E1	Back to summary
C3:D3	Message ID
E3:F3	Properties of \nMessage\n Body
G3:L3	Device Number
M3:N3	Message Sequence Number
O3:Z3	Authentication Code
C4:D4	HEX\n(2 bytes)
E4:F4	HEX\n(2 bytes)
G4:L4	HEX\n(6 bytes)
M4:N4	HEX\n(2 bytes)
O4:Z4	HEX\n(n bytes)
G8:L12	If the device number is not configured:\nit takes the last 12 digits of IMEI number and converts it into BCD code
O9:W10	The length is not fixed, and the content is the same as the authentication code of the device registration response.
E16:I16	Bit 15: sub-package,reserved, default is 0
E17:L17	Bit14: this bit is reserved as 0 by default
E18:I18	Bit 13: sub-package,reserved, default is 0
E19:I19	Bit 12-10: encryption, reserved, default is 0
```

Объединённые диапазоны без значения:

```
J16:L16
```

**Часть 1/1 — диапазон `B1:AB20`**

```tsv
row	B	C	D	E	F	G	H	I	J	K	L	M	N	O	P	Q	R	S	T	U	V	W	X	Y	Z	AA	AB
1	Back to summary				Introduction!A1																						
2	Device Authentication (0x0102)																										
3	Flag	Message ID		Properties of \nMessage\n Body		Device Number						Message Sequence Number		Authentication Code												Checksum Code	Flag
4	HEX\n(1 byte)	HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(2 bytes)		HEX\n(n bytes)												HEX\n(1 byte)	HEX\n(1 byte)
5	1	2	3	4	5	6	7	8	9	10	11	12	13	14	15	16	17	18	19	20	21	22	23	24	25	26	27
6	0x7E	0x01	0x02	0x00	0x0C	0x22	0x10	0x42	0x21	0x43	0x28	0x00	0x02	0x32	0x32	0x31	0x30	0x34	0x32	0x32	0x31	0x34	0x33	0x32	0x38	0x3E	0x7E
7																											
8						If the device number is not configured:\nit takes the last 12 digits of IMEI number and converts it into BCD code																					
9														The length is not fixed, and the content is the same as the authentication code of the device registration response.													
10																											
11																											
12																											
13																											
14																											
15																											
16				Bit 15: sub-package,reserved, default is 0																							
17				Bit14: this bit is reserved as 0 by default																							
18				Bit 13: sub-package,reserved, default is 0																							
19				Bit 12-10: encryption, reserved, default is 0																							
20				Bit 9-0: length of message body																							
```

**Проверка листа:**

- Непустых строк: 13
- Непустых ячеек в исходнике: 80; выгружено в TSV: 80 → совпадает, содержимое извлечено полностью
- Из них числовых (int) ячеек: 27; остальные — строки
- Не представимо текстом корректно: оформление ячеек (заливка, границы, шрифты) и rich-text внутри ячеек не передаются; гиперссылки B1→summary!A1 и F1→Introduction!A1 (адрес ссылки не виден в тексте ячейки); раскладка ячеек на сетке (позиции полей по столбцам) сохранена только через координаты

### 2.4. Лист `0x0001`

- Статус: **visible**
- Объявленный диапазон: `A1:X37`; фактические данные: `B1:U22`
- Исходные заголовки: строки 3, 5 (названия полей), 6 (тип/размер), 7 (номера байтов)
- Объединённые ячейки: всего 24; с текстом/значением в левой верхней ячейке — 23; без значения (только оформление) — 1.
- Скрытых строк и столбцов нет.

Объединённые диапазоны со значением (значение принадлежит всему диапазону; сама ячейка — левая верхняя):

```tsv
range	value
B1:E1	Back to summary
B3:B5	Flag
C3:N4	Message Header
O3:S4	Message Body
T3:T5	Checksum Code
U3:U5	Flag
C5:D5	Message ID
E5:F5	Message Body Properties
G5:L5	Device ID
M5:N5	Message \nSequence\n Number
O5:P5	Response Sequence Number
Q5:R5	Corresponding Device Message ID
C6:D6	HEX\n(2 bytes)
E6:F6	HEX\n(2 bytes)
G6:L6	HEX\n(6 bytes)
M6:N6	HEX\n(2 bytes)
O6:P6	HEX\n(2 bytes)
Q6:R6	HEX\n(2 bytes)
G10:L14	\nThe last 12 digits of IMEI number and converts it into BCD code
E18:I18	Bit 15: Reserved, Default is 0
E19:L19	Bit 14: Reserved, Default is 0
E20:I20	Bit 13: Sub-package, Reserved, Default is 0
E21:I21	Bit 12-10: Encryption, Reserved, Default is 0
```

Объединённые диапазоны без значения:

```
J18:L18
```

**Часть 1/1 — диапазон `B1:U22`**

```tsv
row	B	C	D	E	F	G	H	I	J	K	L	M	N	O	P	Q	R	S	T	U
1	Back to summary				Introduction!A1															
2	Device General Query Response (0x0001)																			
3	Flag	Message Header												Message Body					Checksum Code	Flag
4																				
5		Message ID		Message Body Properties		Device ID						Message \nSequence\n Number		Response Sequence Number		Corresponding Device Message ID		Result		
6	HEX\n(1 byte)	HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(1 byte)	HEX\n(1 byte)	HEX\n(1 byte)
7	1	2	3	4	5	6	7	8	9	10	11	12	13	14	15	16	17	18	19	20
8	0x7E	0x00	0x01	0x00	0x05	0x22	0x10	0x42	0x21	0x43	0x28	0x00	0x01	0x00	0x04	0x02	0x00	0x00	0xB9	0x7E
9																				
10						\nThe last 12 digits of IMEI number and converts it into BCD code														
11																				
12																				
13																		0: Success		
14																		1: Fail		
15																		2: Wrong message		
16																		3: Not support		
17																				
18				Bit 15: Reserved, Default is 0																
19				Bit 14: Reserved, Default is 0												Corresponding device message ID				
20				Bit 13: Sub-package, Reserved, Default is 0										The sequence number of the corresponding server message 						
21				Bit 12-10: Encryption, Reserved, Default is 0																
22				Bit 9-0: Length of message body																
```

**Проверка листа:**

- Непустых строк: 17
- Непустых ячеек в исходнике: 77; выгружено в TSV: 77 → совпадает, содержимое извлечено полностью
- Из них числовых (int) ячеек: 20; остальные — строки
- Не представимо текстом корректно: оформление ячеек (заливка, границы, шрифты) и rich-text внутри ячеек не передаются; гиперссылки B1→summary!A1 и F1→Introduction!A1 (адрес ссылки не виден в тексте ячейки); раскладка ячеек на сетке (позиции полей по столбцам) сохранена только через координаты

### 2.5. Лист `0x0104`

- Статус: **visible**
- Объявленный диапазон: `A1:AJ38`; фактические данные: `B1:AB22`
- Исходные заголовки: строки 3, 5, 6, 7
- Объединённые ячейки: всего 26; с текстом/значением в левой верхней ячейке — 25; без значения (только оформление) — 1.
- Скрытых строк и столбцов нет.

Объединённые диапазоны со значением (значение принадлежит всему диапазону; сама ячейка — левая верхняя):

```tsv
range	value
B1:E1	Back to summary
B3:B5	Flag
C3:N4	Message Header
O3:Z4	Message Body
AA3:AA5	Checksum Code
AB3:AB5	Flag
C5:D5	Message ID
E5:F5	Message Body Properties
G5:L5	Device ID
M5:N5	Message Sequence Number
O5:P5	Response Sequence Number
R5:U5	Parameter ID
W5:Z5	Parameter value
C6:D6	HEX\n(2 bytes)
E6:F6	HEX\n(2 bytes)
G6:L6	HEX\n(6 bytes)
M6:N6	HEX\n(2 bytes)
O6:P6	HEX\n(2 bytes)
R6:U6	HEX\n(4 bytes)
W6:Z6	HEX\n(4 bytes)
G10:L14	The last 12 digits of IMEI number and converts it into BCD code
E18:I18	Bit 15: Reserved, Default is 0
E19:L19	Bit 14: Reserved, Default is 0
E20:I20	Bit 13: Sub-package, Reserved, Default is 0
E21:I21	Bit 12-10: Encryption, Reserved, Default is 0
```

Объединённые диапазоны без значения:

```
J18:L18
```

**Часть 1/1 — диапазон `B1:AB22`**

```tsv
row	B	C	D	E	F	G	H	I	J	K	L	M	N	O	P	Q	R	S	T	U	V	W	X	Y	Z	AA	AB
1	Back to summary				Introduction!A1																						
2	Device Query Response (0x0104)																										
3	Flag	Message Header												Message Body												Checksum Code	Flag
4																											
5		Message ID		Message Body Properties		Device ID						Message Sequence Number		Response Sequence Number		Total Number Of Response Parameters	Parameter ID				 Parameter Length	Parameter value					
6	HEX\n(1 byte)	HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(1 byte)	HEX\n(4 bytes)				HEX\n(1 byte)	HEX\n(4 bytes)				HEX\n(1 byte)	HEX\n(1 byte)
7	1	2	3	4	5	6	7	8	9	10	11	12	13	14	15	16	17	18	19	20	21	22	23	24	25	26	27
8	0x7E	0x01	0x04	0x00	0x0F	0x22	0x10	0x42	0x21	0x43	0x28	0x00	0x01	0x00	0x01	0x0C	0x00	0x00	0x00	0x01	0x04	0x00	0x00	0x00	0x1D	0x3F	0x7E
9																											
10						The last 12 digits of IMEI number and converts it into BCD code																					
11																											
12																											
13																											
14																										.	
15																											
16																	Refer to 0x8103 (Table 1)										
17																											
18				Bit 15: Reserved, Default is 0																							
19				Bit 14: Reserved, Default is 0																							
20				Bit 13: Sub-package, Reserved, Default is 0																							
21				Bit 12-10: Encryption, Reserved, Default is 0																							
22				Bit 9-0: Length of message body																							
```

**Проверка листа:**

- Непустых строк: 15
- Непустых ячеек в исходнике: 91; выгружено в TSV: 91 → совпадает, содержимое извлечено полностью
- Из них числовых (int) ячеек: 27; остальные — строки
- Не представимо текстом корректно: оформление ячеек (заливка, границы, шрифты) и rich-text внутри ячеек не передаются; гиперссылки B1→summary!A1 и F1→Introduction!A1 (адрес ссылки не виден в тексте ячейки); раскладка ячеек на сетке (позиции полей по столбцам) сохранена только через координаты

### 2.6. Лист `0x0200`

- Статус: **visible**
- Объявленный диапазон: `A1:IJ58`; фактические данные: `A1:II53`
- Исходные заголовки: строки 3, 5, 6, 7 (первый блок); строки 47, 49 (второй блок — таблица серий)
- Объединённые ячейки: всего 176; с текстом/значением в левой верхней ячейке — 167; без значения (только оформление) — 9.
- Скрытых строк и столбцов нет.

Объединённые диапазоны со значением (значение принадлежит всему диапазону; сама ячейка — левая верхняя):

```tsv
range	value
B1:E1	Back to summary
B3:B5	Flag
C3:N4	Message Header
O3:IG4	Message Body
IH3:IH5	Checksum Code
II3:II5	Flag
C5:D5	Message ID
E5:F5	Message Body Properties
G5:L5	Device ID
M5:N5	Message Sequence Number
O5:R5	Alarm Sign
S5:V5	Status 
W5:Z5	Latitude 
AA5:AD5	Longitude
AE5:AF5	Altitude 
AG5:AH5	Speed
AI5:AJ5	Direction 
AK5:AP5	Time
AQ5:AV5	(mile): Mileage
AW5:AY5	(csq): Cellular Network Signal Strength
AZ5:BB5	(gpsnum): Number Of GNSS Satellites Used
BC5:BQ5	(bs): Base Station Information  (bs_s : serving cell ; bs_n : neigbour cell )
BR5:CI5	(fw): Device Firmware Version 
CJ5:DU5	(bt): Bluetooth Data Scanned List
DV5:ED5	(wifi): WiFi List
EE5:FJ5	(sensor): Trigger Event Type And Sensor Information
FK5:FR5	(battery): Battery Information
FS5:GW5	(devinfo): Device General Information
GX5:IC5	(assist): Assistant Information
C6:D6	HEX\n(2 bytes)
E6:F6	HEX\n(2 bytes)
G6:L6	HEX\n(6 bytes)
M6:N6	HEX\n(2 bytes)
O6:R6	HEX\n(4 bytes)
S6:V6	HEX\n(4 bytes)
W6:Z6	HEX\n(4 bytes)
AA6:AD6	HEX\n(4 bytes)
AE6:AF6	HEX\n(2 bytes)
AG6:AH6	HEX\n(2 bytes)
AI6:AJ6	HEX\n(2 bytes)
AK6:AP6	HEX\n(6 bytes)
AQ6:AV6	HEX\n(6 bytes)
AW6:AY6	HEX\n(3 bytes)
AZ6:BB6	HEX\n(3 bytes)
BC6:BQ6	HEX\n(2+m*13bytes)
BR6:CI6	HEX\n(2+n bytes)
CJ6:DU6	HEX\n(2+1+m*(6+1+[10]+[2]+[2]+[2]+[2]+[6]+[2]+[2]) bytes)
DV6:ED6	HEX\n(2+m*7 bytes)
EE6:FJ6	HEX\n(2+1+1+m*([2]+[2]+[2]+[6]+[10]+[2]+[2]+[2]) bytes) 
FK6:FR6	HEX\n(2+4+[1+[1]] bytes)
FS6:GW6	HEX\n(31 bytes)
GX6:HY6	HEX\n(2+2+[4]+[4]+[2]+[6]+[4]+[4]+[2]+[2] bytes)
G11:L16	The last 12 digits of IMEI number and converts it into BCD code
S11:Y11	Bit 31: 0: Real time data   1: Buffered data
CM11:DA27	Bluetooth node [MAC,RSSI,Name,FwVer,Voltage,Temperature,Humidity,Accelerometer(X,Y,Z),Res1,Res2]\nMAC: 6 bytes\nRSSI: 1 byte\nName: 10 bytes (string)\nFwVer: 2 bytes (BCD)\nVoltage: 2 bytes\nTemperature: 2 bytes\nHumidity: 2 bytes\nAccelerometer (X,Y,Z): 6 bytes\nRes1: Reserved, 2 bytes\nRSSI&0m: 2 bytes
EI11:FF26	Sensors information [Light,Temperature,Humidity,Accelerometer,limit(Light,Tmax,Tmin,Hmax,Hmin),Bar,Res2,Res3]\nLight: 2 bytes\nTemperature: 2 bytes\nHumidity: 2 bytes\nAccelerometer: 6 bytes\nLimit (Light,Tmax,Tmin,Hmax,Hmin): 10 bytes\nBar: 2 bytes    (unit: hPa)\nRes2: 2 bytes\nRes3: 2 bytes
FM11:FQ23	Battery voltage (mV): 4 bytes\nCharge status (optional): 1 byte\n0: Invalid\n1: Uncharged\n2: Charging\n3: Full charging\n4: Abnormal\nBattery level percentage (optional): 1 byte
FU11:GE29	Work mode: 1 byte\n0: Reserved\n1: Reserved\n2: Tracking mode+Trigger mode\n3: Reserved\n4: Periodic mode+Trigger mode\nIMEI: 8 bytes (BCD)\nICCID: 10 bytes  (BCD)\nDevice PartNumber: 10 bytes  (STRING)\nFor example: GM100LA-CC
S12:Y12	Bit 30: Reserved
BE12:BJ24	Base station information [MCC,MNC,CI,LAC,RSSI]\nMCC: 2 bytes\nMNC: 2 byte\nCI: 4 bytes\nLAC: 4 bytes\nRSSI: 1 byte
S13:Y13	Bit 29-27: Network modes: 000: UNREGISTERED,  001:GSM,  010:LTE,  011:CATM,  100: NBIOT
DX13:DZ16	WiFi node [MAC,RSSI]\nMAC: 6 bytes\nRSSI: 1 byte
S14:Y14	Bit 5-26: Reserved
S15:Y15	Bit 4: 0: Unsampled data 1: Sampled data
S16:Y16	Bit 3: 0: East longitude   1:West longitude
S17:X17	Bit 2: 0: North latitude   1: South latitude
HV17:HW17	Report interval
S18:Y18	Bit 1: GNSS position 0: Unfix   1: Fix 
IB18:IC18	Ext Temp
S19:Y19	Bit 0: Reserved
BR20:BX24	Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual\n
HZ20:IH22	Sensor Type:\nMask Bit 0-15 identified[\nBIT 0: External Temperature sensor\nBIT 1-15: Reserved]
GZ21:HJ21	Mask Bit 0-15 identified \nBit 0: GNSS age (Reserved)\nBit 1: ACC on time (Reserved)\nBit 2: HDOP\nBit 3: GNSS time (Reserved)\nBit 4: Reserved\nBit 5: Sample report time (Sampling and report interval)\nBit 6: External temperature sensor\nBit 7-15: Reserved
E22:I22	Bit 15: Reserved, Default is 0
E23:L23	Bit 14: Reserved, Default is 0
DV23:EB25	Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual; default not to report
E24:I24	Bit 13: Sub-package, Reserved, Default is 0
E25:I25	Bit 12-10: Encryption, Reserved, Default is 0
O26:U26	Bit 31: Reserved, Default is 0
FK26:FR27	Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual; default not to report
O27:U27	Bit 28: Reserved, Default is 0
BC27:BI28	Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual
O28:U28	Bit 16: Motion alarm  0: Static   1: Movement
BB29:BG30	GNSS positioning satellite number
EG29:EY39	Data type：\n\n0: Periodic sampling 1: Low battery trigger event 2: Motion trigger event 3: Shock trigger event 4: Light trigger event 5: Over temperature and humidity trigger 6: Over temperature trigger 7: Over humidity trigger 8: Reserved  9: Bluetooth sensor connection trigger* 10. Entry flight mode 11. Flight sampling 12. Exit flight mode. 13. Over temperature in external probe 14 -74: Reserved 75:OTA firmware upgrade start 76: OTA firmware upgrade succeed  77:OTA firmware upgrade failed
O32:U32	Bit 4: Reserved, Default is 0
O33:U33	Bit 1: Reserved, Default is 0
AZ33:BI34	Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual
O34:U34	Bit 0,2,3,5,6,9-14,17-27,29,30: Reserved, Default is 0
AY36:BC36	Mobile network signal strength
AW39:BC40	Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual
EF41:EO41	Extension information length
B47:B49	Flag
C47:N48	Message Header
O47:IG48	Message Body
IH47:IH49	Checksum Code
II47:II49	Flag
C49:D49	Message ID
E49:F49	Message Body Properties
G49:L49	Device ID
M49:N49	Message Sequence Number
O49:R49	Alarm Sign
S49:V49	Status 
W49:Z49	Latitude 
AA49:AD49	Longitude
AE49:AF49	Altitude 
AG49:AH49	Speed
AI49:AJ49	Direction 
AK49:AP49	Time
AQ49:AV49	(mile): Mileage
AW49:AY49	(csq): Cellular Network Signal Strength
AZ49:BB49	(gpsnum): Number Of GNSS Satellites Used
BC49:BQ49	(bs): Base Station Information  (bs_s : serving cell ; bs_n : neigbour cell )
BR49:CI49	(fw): Device Firmware Version 
CJ49:DU49	(bt): Bluetooth Data Scanned List
DV49:ED49	(wifi): WiFi List
EE49:FJ49	(sensor): Trigger Event Type And Sensor Information
FK49:FR49	(battery): Battery Information
FS49:GW49	(devinfo): Device General Information
GX49:IC49	(assist): Assistant Information
C50:D50	★
E50:F50	★
G50:L50	★
M50:N50	★
O50:R50	★
S50:V50	★
W50:Z50	●
AA50:AD50	●
AE50:AF50	●
AG50:AH50	●
AI50:AJ50	●
AK50:AP50	★
AQ50:AV50	☆
AW50:AY50	☆
AZ50:BB50	☆
BC50:BQ50	★
BR50:CI50	☆
CJ50:DU50	☆
DV50:ED50	☆
EE50:FJ50	★
FK50:FR50	★
FS50:GW50	☆
GX50:HY50	☆
C51:D51	★
E51:F51	★
G51:L51	★
M51:N51	★
O51:R51	★
S51:V51	★
W51:Z51	★
AA51:AD51	★
AE51:AF51	●
AG51:AH51	●
AI51:AJ51	●
AK51:AP51	★
AQ51:AV51	☆
AW51:AY51	☆
AZ51:BB51	☆
BC51:BQ51	★
BR51:CI51	☆
CJ51:DU51	☆
DV51:ED51	☆
EE51:FJ51	★
FK51:FR51	★
FS51:GW51	☆
GX51:HY51	☆
B53:L53	Remark:\n★This field is supported. It is reported by default.\n☆This field is supported. It is not reported by default but can reported by configuration.\n●This field is supported. The default reporting value is 0.\n×This field is not supported.\n
```

Объединённые диапазоны без значения:

```
IH9:IH12, IH17:II17, S20:Y21, J22:L22, S22:Y22, S23:Y23, S24:Y24, O25:U25, B54:O58
```

**Часть 1/4 — диапазон `A1:BL53`**

```tsv
row	A	B	C	D	E	F	G	H	I	J	K	L	M	N	O	P	Q	R	S	T	U	V	W	X	Y	Z	AA	AB	AC	AD	AE	AF	AG	AH	AI	AJ	AK	AL	AM	AN	AO	AP	AQ	AR	AS	AT	AU	AV	AW	AX	AY	AZ	BA	BB	BC	BD	BE	BF	BG	BH	BI	BJ	BK	BL
1		Back to summary				Introduction!A1																																																										
2		Device Basic Information Message (0x0200)																																																														
3		Flag	Message Header												Message Body																																																	
4																																																																
5			Message ID		Message Body Properties		Device ID						Message Sequence Number		Alarm Sign				Status 				Latitude 				Longitude				Altitude 		Speed		Direction 		Time						(mile): Mileage						(csq): Cellular Network Signal Strength			(gpsnum): Number Of GNSS Satellites Used			(bs): Base Station Information  (bs_s : serving cell ; bs_n : neigbour cell )									
6		HEX\n(1 byte)	HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(2 bytes)		HEX\n(4 bytes)				HEX\n(4 bytes)				HEX\n(4 bytes)				HEX\n(4 bytes)				HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(6 bytes)						HEX\n(3 bytes)			HEX\n(3 bytes)			HEX\n(2+m*13bytes)									
7		1	2	3	4	5	6	7	8	9	10	11	12	13	14	15	16	17	18	19	20	21	22	23	24	25	26	27	28	29	30	31	32	33	34	35	36	37	38	39	40	41	42	43	44	45	46	47	48	49	50	51	52	53	54	55	56	57	58	59	60	61	62	63
8		0x7E	0x02	0x00	0x00	0x4C	0x22	0x10	0x42	0x21	0x43	0x28	0x00	0x0A	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x03	0x01	0xE6	0x11	0xBE	0x06	0xFC	0x5D	0xC0	0x00	0x41	0x00	0x00	0x00	0x00	0x21	0x09	0x28	0x17	0x23	0x05	0x01	0x04	0x00	0x00	0x00	0x00	0x30	0x01	0x16	0x31	0x01	0x07	0xF0	0x0D	0x00	0x00	0x00	0x00	0x5D	0xBB	0x00	0x00
9																																																																
10																																																																
11							The last 12 digits of IMEI number and converts it into BCD code												Bit 31: 0: Real time data   1: Buffered data																																													
12																			Bit 30: Reserved																		BCD[6]																				Base station information [MCC,MNC,CI,LAC,RSSI]\nMCC: 2 bytes\nMNC: 2 byte\nCI: 4 bytes\nLAC: 4 bytes\nRSSI: 1 byte							
13																			Bit 29-27: Network modes: 000: UNREGISTERED,  001:GSM,  010:LTE,  011:CATM,  100: NBIOT																																													
14																			Bit 5-26: Reserved																																													
15																			Bit 4: 0: Unsampled data 1: Sampled data																																													
16																			Bit 3: 0: East longitude   1:West longitude																																													
17																			Bit 2: 0: North latitude   1: South latitude																																													
18																			Bit 1: GNSS position 0: Unfix   1: Fix 																																													
19																			Bit 0: Reserved																																													
20																																																																
21																																																																
22					Bit 15: Reserved, Default is 0																																																											
23					Bit 14: Reserved, Default is 0																																																											
24					Bit 13: Sub-package, Reserved, Default is 0																																																											
25					Bit 12-10: Encryption, Reserved, Default is 0																																																											
26					Bit 9-0: Length of message body										Bit 31: Reserved, Default is 0																																									Extension information length								
27															Bit 28: Reserved, Default is 0																																								Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual									
28															Bit 16: Motion alarm  0: Static   1: Movement																																																	
29															Bit 15: Reserved, Default is 0																																							GNSS positioning satellite number										
30															Bit 8: Reserved, Default is 0																																																	
31															Bit 7: Reserved, Default is 0																																																	
32															Bit 4: Reserved, Default is 0																																						Extension information length											
33															Bit 1: Reserved, Default is 0																																					Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual												
34															Bit 0,2,3,5,6,9-14,17-27,29,30: Reserved, Default is 0																																																	
35																																																																
36																																																			Mobile network signal strength													
37																																																																
38																																																		Extension information length														
39																																															`		Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual															
40																																																																
41																																													Total mileage																			
42																																																																
43																																												Extension information length																				
44																																																																
45																																											Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual 																					
46																																																																
47		Flag	Message Header												Message Body																																																	
48																																																																
49	Device PN		Message ID		Message Body Properties		Device ID						Message Sequence Number		Alarm Sign				Status 				Latitude 				Longitude				Altitude 		Speed		Direction 		Time						(mile): Mileage						(csq): Cellular Network Signal Strength			(gpsnum): Number Of GNSS Satellites Used			(bs): Base Station Information  (bs_s : serving cell ; bs_n : neigbour cell )									
50	G Series	★	★		★		★						★		★				★				●				●				●		●		●		★						☆						☆			☆			★									
51	A Sereis	★	★		★		★						★		★				★				★				★				●		●		●		★						☆						☆			☆			★									
52																																																																
53		Remark:\n★This field is supported. It is reported by default.\n☆This field is supported. It is not reported by default but can reported by configuration.\n●This field is supported. The default reporting value is 0.\n×This field is not supported.\n																																																														
```

**Часть 2/4 — диапазон `BM1:DX53`**

```tsv
row	BM	BN	BO	BP	BQ	BR	BS	BT	BU	BV	BW	BX	BY	BZ	CA	CB	CC	CD	CE	CF	CG	CH	CI	CJ	CK	CL	CM	CN	CO	CP	CQ	CR	CS	CT	CU	CV	CW	CX	CY	CZ	DA	DB	DC	DD	DE	DF	DG	DH	DI	DJ	DK	DL	DM	DN	DO	DP	DQ	DR	DS	DT	DU	DV	DW	DX
1																																																																
2																																																																
3																																																																
4																																																																
5						(fw): Device Firmware Version 																		(bt): Bluetooth Data Scanned List																																						(wifi): WiFi List		
6						HEX\n(2+n bytes)																		HEX\n(2+1+m*(6+1+[10]+[2]+[2]+[2]+[2]+[6]+[2]+[2]) bytes)																																						HEX\n(2+m*7 bytes)		
7	64	65	66	67	68	75	76	77	78	79	80	81	82	83	84	85	86	87	88	89	90	91	92	93	94	95	96	97	98	99	100	101	102	103	104	105	106	107	108	109	110	111	112	113	114	115	116	117	118	119	120	121	122	123	124	125	126	127	128	129	130	131	132	133
8	0x55	0x0A	0x00	0x00	0xBB	0xF2	0X10	0x41	0x4F	0x56	0x58	0x5F	0x56	0x32	0x30	0x5F	0x31	0x2E	0x30	0x2E	0x30	0x30	0x30	0xF3	0x1E	1F	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0xF4	0x07	0x00
9																																																																
10																																																																
11																											Bluetooth node [MAC,RSSI,Name,FwVer,Voltage,Temperature,Humidity,Accelerometer(X,Y,Z),Res1,Res2]\nMAC: 6 bytes\nRSSI: 1 byte\nName: 10 bytes (string)\nFwVer: 2 bytes (BCD)\nVoltage: 2 bytes\nTemperature: 2 bytes\nHumidity: 2 bytes\nAccelerometer (X,Y,Z): 6 bytes\nRes1: Reserved, 2 bytes\nRSSI&0m: 2 bytes																																					
12																																																																
13																																																																WiFi node [MAC,RSSI]\nMAC: 6 bytes\nRSSI: 1 byte
14								Device firmware version (string ACSII)																																																								
15																																																																
16																																																																
17							Extension information length																																																									
18																																																																
19																																																																
20						Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual\n																																																									Extension length	
21																																																																
22																																																																
23																																																														Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual; default not to report		
24																																																																
25																																																																
26																																																																
27																																																																
28																																																																
29																										The field mask bit 0-7 respectively identifies[Name,FwVer,Voltage,Temperature,Humidity,Accelerometer,Res1,Res2] . This mask can be configured by command AT+BTMODE																																						
30																																																																
31																									Extension information length																																							
32																																																																
33																								Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual; default not to report																																								
34																																																																
35																																																																
36																																																																
37																																																																
38																																																																
39																																																																
40																																																																
41																																																																
42																																																																
43																																																																
44																																																																
45																																																																
46																																																																
47																																																																
48																																																																
49						(fw): Device Firmware Version 																		(bt): Bluetooth Data Scanned List																																						(wifi): WiFi List		
50						☆																		☆																																						☆		
51						☆																		☆																																						☆		
52																																																																
53																																																																
```

**Часть 3/4 — диапазон `DY1:GJ53`**

```tsv
row	DY	DZ	EA	EB	EC	ED	EE	EF	EG	EH	EI	EJ	EK	EL	EM	EN	EO	EP	EQ	ER	ES	ET	EU	EV	EW	EX	EY	EZ	FA	FB	FC	FD	FE	FF	FG	FH	FI	FJ	FK	FL	FM	FN	FO	FP	FQ	FR	FS	FT	FU	FV	FW	FX	FY	FZ	GA	GB	GC	GD	GE	GF	GG	GH	GI	GJ
1																																																																
2																																																																
3																																																																
4																																																																
5							(sensor): Trigger Event Type And Sensor Information																																(battery): Battery Information								(devinfo): Device General Information																	
6							HEX\n(2+1+1+m*([2]+[2]+[2]+[6]+[10]+[2]+[2]+[2]) bytes) 																																HEX\n(2+4+[1+[1]] bytes)								HEX\n(31 bytes)																	
7	134	135	136	137	138	139	150	151	152	153	154	155	156	157	158	159	160	161	162	163	164	165	166	167	168	169	170	171	172	173	174	175	176	177	178	179	180	181	182	183	184	185	186	187	188	189	190	191	192	193	194	195	196	197	198	199	200	201	202	203	204	205	206	207
8	0x00	0x00	0x00	0x00	0x00	0x00	0xF6	0x1E	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0xF7	0x06	0x00	0x00	0x00	0x00	0x00	0x00	0xF8	0x1B	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00
9																																																																
10																																																																
11											Sensors information [Light,Temperature,Humidity,Accelerometer,limit(Light,Tmax,Tmin,Hmax,Hmin),Bar,Res2,Res3]\nLight: 2 bytes\nTemperature: 2 bytes\nHumidity: 2 bytes\nAccelerometer: 6 bytes\nLimit (Light,Tmax,Tmin,Hmax,Hmin): 10 bytes\nBar: 2 bytes    (unit: hPa)\nRes2: 2 bytes\nRes3: 2 bytes																														Battery voltage (mV): 4 bytes\nCharge status (optional): 1 byte\n0: Invalid\n1: Uncharged\n2: Charging\n3: Full charging\n4: Abnormal\nBattery level percentage (optional): 1 byte								Work mode: 1 byte\n0: Reserved\n1: Reserved\n2: Tracking mode+Trigger mode\n3: Reserved\n4: Periodic mode+Trigger mode\nIMEI: 8 bytes (BCD)\nICCID: 10 bytes  (BCD)\nDevice PartNumber: 10 bytes  (STRING)\nFor example: GM100LA-CC															
12																																																																
13																																																																
14																																																																
15																																																																
16																																																																
17																																																																
18																																																																
19																																																																
20																																																																
21																																																																
22																																																																
23																																																																
24																																																																
25																																								Extension information length																								
26																																							Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual; default not to report																									
27																																																																
28										Field masks bit 0-7 identifies [Light,Temperature,Humidity,Accelerometer,limit,Bar,Res2,Res3] .This mask can be configured by command AT+SENSORMASK																																																						
29									Data type：\n\n0: Periodic sampling 1: Low battery trigger event 2: Motion trigger event 3: Shock trigger event 4: Light trigger event 5: Over temperature and humidity trigger 6: Over temperature trigger 7: Over humidity trigger 8: Reserved  9: Bluetooth sensor connection trigger* 10. Entry flight mode 11. Flight sampling 12. Exit flight mode. 13. Over temperature in external probe 14 -74: Reserved 75:OTA firmware upgrade start 76: OTA firmware upgrade succeed  77:OTA firmware upgrade failed																																																							
30																																																																
31																																																Extension information length																
32																																																																
33																																															Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual; 																	
34																																																																
35																																																																
36																																																																
37																																																																
38																																																																
39																																																																
40																																																																
41								Extension information length																																																								
42																																																																
43							Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual; default not to report																																																									
44																																																																
45																																																																
46																																																																
47																																																																
48																																																																
49							(sensor): Trigger Event Type And Sensor Information																																(battery): Battery Information								(devinfo): Device General Information																	
50							★																																★								☆																	
51							★																																★								☆																	
52																																																																
53																																																																
```

**Часть 4/4 — диапазон `GK1:II53`**

```tsv
row	GK	GL	GM	GN	GO	GP	GQ	GR	GS	GT	GU	GV	GW	GX	GY	GZ	HA	HB	HC	HD	HE	HF	HG	HH	HI	HJ	HK	HL	HM	HN	HO	HP	HQ	HR	HS	HT	HU	HV	HW	HX	HY	HZ	IA	IB	IC	ID	IE	IF	IG	IH	II
1																																																			
2																																																			
3																																																		Checksum Code	Flag
4																																																			
5														(assist): Assistant Information																																					
6														HEX\n(2+2+[4]+[4]+[2]+[6]+[4]+[4]+[2]+[2] bytes)																																				HEX\n(1 byte)	HEX\n(1 byte)
7	208	209	210	211	212	213	214	215	216	217	218	219	220	221	222	223	224	225	226	227	228	229	230	231	232	233	234	235	236	237	238	239	240	241	242	243	244	245	246	247	248	249	250	251	252	253	254	255	256	257	258
8	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0xF9	0x04	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x00	0x29	0x7E
9																																																			
10																																																			
11																																																			
12																																																			
13																																																			
14																																																Ext Temp Min			
15																																																			
16																																																			
17																		GNSS age (Reserved)				ACC on time (Reserved)				HDOP 		GNSS time (Reserved)						Sampling interval				Report interval								Ext Temp Max					
18																																												Ext Temp							
19																																																			
20																																										Sensor Type:\nMask Bit 0-15 identified[\nBIT 0: External Temperature sensor\nBIT 1-15: Reserved]									
21																Mask Bit 0-15 identified \nBit 0: GNSS age (Reserved)\nBit 1: ACC on time (Reserved)\nBit 2: HDOP\nBit 3: GNSS time (Reserved)\nBit 4: Reserved\nBit 5: Sample report time (Sampling and report interval)\nBit 6: External temperature sensor\nBit 7-15: Reserved																																			
22																																																			
23																																																			
24															Extension information length																																				
25														Extension information ID, Extension information can be configured  by command AT+REPORTMASK in AT command manual; Default not to report																																					
26																																																			
27																																																			
28																																																			
29																																																			
30																																																			
31																																																			
32																																																			
33																																																			
34																																																			
35																																																			
36																																																			
37																																																			
38																																																			
39																																																			
40																																																			
41																																																			
42																																																			
43																																																			
44																																																			
45																																																			
46																																																			
47																																																		Checksum Code	Flag
48																																																			
49														(assist): Assistant Information																																					
50														☆																																				★	★
51														☆																																				★	★
52																																																			
53																																																			
```

**Проверка листа:**

- Непустых строк: 42
- Непустых ячеек в исходнике: 697; выгружено в TSV: 697 → совпадает, содержимое извлечено полностью
- Из них числовых (int) ячеек: 242; остальные — строки
- Не представимо текстом корректно: форматирование (заливка, границы, цвета, выравнивание), символы-маркеры ★ ☆ ● × передаются как текст, но их цветовое оформление — нет; гиперссылки B1→summary!A1 и F1→Introduction!A1 (адрес ссылки не виден в тексте ячейки); раскладка ячеек на сетке (позиции полей по столбцам) сохранена только через координаты

### 2.7. Лист `0x0900`

- Статус: **visible**
- Объявленный диапазон: `A1:GL49`; фактические данные: `B1:AV37`
- Исходные заголовки: строки 3, 5, 6, 7
- Объединённые ячейки: всего 47; с текстом/значением в левой верхней ячейке — 44; без значения (только оформление) — 3.
- Скрытые строки: нет; скрытые столбцы: AN, AO, AP, AQ, AR, AS. Непустые ячейки в них (выгружены ниже наравне с остальными): AN5, AN6, AN7, AO7, AP7, AQ7, AR7, AS7, AN8, AO8, AP8, AQ8, AR8, AS8, AR31, AP33, AO35, AN37

Объединённые диапазоны со значением (значение принадлежит всему диапазону; сама ячейка — левая верхняя):

```tsv
range	value
B1:E1	Back to summary
B3:B5	Flag
C3:N4	Message Header
O3:AT4	Message Body
AU3:AU5	Checksum Code
AV3:AV5	Flag
C5:D5	Message ID
E5:F5	Message Body Properties
G5:L5	Device ID
M5:N5	Message Sequence Number
P5:S5	Status 
T5:W5	Latitude 
X5:AA5	Longitude
AB5:AC5	Altitude 
AD5:AE5	Speed
AF5:AG5	Direction 
AH5:AM5	Time
AN5:AS5	Mileage(only support V Serise )
C6:D6	HEX\n(2 bytes)
E6:F6	HEX\n(2 bytes)
G6:L6	HEX\n(6 bytes)
M6:N6	HEX\n(2 bytes)
P6:S6	HEX\n(4 bytes)
T6:W6	HEX\n(4 bytes)
X6:AA6	HEX\n(4 bytes)
AB6:AC6	HEX\n(2 bytes)
AD6:AE6	HEX\n(2 bytes)
AF6:AG6	HEX\n(2 bytes)
AH6:AM6	HEX\n(6 bytes)
AN6:AS6	HEX\n(6 bytes)
AT9:AW26	\neg. Bluetooth transparent data：\nBTPoeCnt (1 byte) +t* [BTIndex (1 byte) +BTMACAddr (6 byte) +BTRSSI (1 byte)+ DataLen（1 byte）+Data (m byte  m≤31 byte)]                                                    \n\nSensor log transparent data：\n \n[Sensor log mask (2 byte)\n[BIT 0: Light  \nBIT 1: Internal temp and humi \nBIT 2: External temp  \nBIT 3: Accelerometer  \nBIT 4: Air Pressure  \nBIT 5-7: Reserved]+Sample time ( BCD[6]) +Light (2 byte) + Built-in temperature (2 byte) +Built-in humidity (2 byte)+ External temperature (2 byte)+Acceleration（6 byte）+Air Pressure (2 byte)]*m( m≤35)      
G10:L25	The last 12 digits of IMEI number and converts it into BCD code
P13:V13	Bit 31: 0: Real time data   1: Buffered data
P14:V14	Bit 30: Reserved
P16:V16	Bit 5-26: Reserved
P17:S17	Bit 4: 0: Unsampled data 1: Sampled data
P18:S18	Bit 3: 0: East longitude  1: West longitude
P19:U19	Bit 2: 0: North latitude   1: South latitude
P20:V20	Bit 1: GNSS position 0: Unfix   1: Fix 
P21:V21	Bit 0: Reserved
E29:I29	Bit 15: Reserved, Default is 0
E30:L30	Bit 14: Reserved, Default is 0
E31:I31	Bit 13: Sub-package, Reserved, Default is 0
E32:I32	Bit 12-10: Encryption, Reserved, Default is 0
```

Объединённые диапазоны без значения:

```
AT27:AT28, J29:L29, AN38:AT44
```

**Часть 1/1 — диапазон `B1:AV37`**

```tsv
row	B	C	D	E	F	G	H	I	J	K	L	M	N	O	P	Q	R	S	T	U	V	W	X	Y	Z	AA	AB	AC	AD	AE	AF	AG	AH	AI	AJ	AK	AL	AM	AN	AO	AP	AQ	AR	AS	AT	AU	AV
1	Back to summary				Introduction!A1																																										
2	Device Additional Information (0x0900) 																																														
3	Flag	Message Header												Message Body																																Checksum Code	Flag
4																																															
5		Message ID		Message Body Properties		Device ID						Message Sequence Number		Data Transparent Transmission Type	Status 				Latitude 				Longitude				Altitude 		Speed		Direction 		Time						Mileage(only support V Serise )						Transparent Transmission Data		
6	HEX\n(1 byte)	HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(2 bytes)		HEX\n(1 byte)	HEX\n(4 bytes)				HEX\n(4 bytes)				HEX\n(4 bytes)				HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(6 bytes)						HEX\n(n bytes)	HEX\n(1 byte)	HEX\n(1 byte)
7	1	2	3	4	5	6	7	8	9	10	11	12	13	14	15	16	17	18	19	20	21	22	23	24	25	26	27	28	29	30	31	32	33	34	35	36	37	38	39	40	41	42	43	44	45	46	47
8	0x7E	0x09	0x00	0x00	0x0F	0x22	0x10	0x42	0x21	0x43	0x28	0x00	0x01	0x41	0x00	0x00	0x00	0x03	0x01	0xE6	0x11	0xBE	0x06	0xFC	0x5D	0xC0	0x00	0x41	0x00	0x00	0x00	0x00	0x21	0x09	0x28	0x17	0x23	0x05	0x01	0x04	0x00	0x00	0x00	0x00	0x00	0x3F	0x7E
9																																													\neg. Bluetooth transparent data：\nBTPoeCnt (1 byte) +t* [BTIndex (1 byte) +BTMACAddr (6 byte) +BTRSSI (1 byte)+ DataLen（1 byte）+Data (m byte  m≤31 byte)]                                                    \n\nSensor log transparent data：\n \n[Sensor log mask (2 byte)\n[BIT 0: Light  \nBIT 1: Internal temp and humi \nBIT 2: External temp  \nBIT 3: Accelerometer  \nBIT 4: Air Pressure  \nBIT 5-7: Reserved]+Sample time ( BCD[6]) +Light (2 byte) + Built-in temperature (2 byte) +Built-in humidity (2 byte)+ External temperature (2 byte)+Acceleration（6 byte）+Air Pressure (2 byte)]*m( m≤35)      		
10						The last 12 digits of IMEI number and converts it into BCD code																																									
11																																															
12																																															
13															Bit 31: 0: Real time data   1: Buffered data																																
14															Bit 30: Reserved																																
15															Bit 27-29: Network modes, 000: UNREGISTERED,  001: GSM,  010: LTE,  011: CATM,  100: NBIOT																																
16															Bit 5-26: Reserved																																
17															Bit 4: 0: Unsampled data 1: Sampled data																																
18															Bit 3: 0: East longitude  1: West longitude																																
19															Bit 2: 0: North latitude   1: South latitude																																
20															Bit 1: GNSS position 0: Unfix   1: Fix 																																
21															Bit 0: Reserved																																
22																																															
23																																	BCD[6]														
24																																															
25																																															
26																																															
27																																															
28														0x53: Bluetooth transparent data 																																	
29				Bit 15: Reserved, Default is 0										0x54: Sensor log, Transparent data (Only for customer's custom firmware)																																	
30				Bit 14: Reserved, Default is 0																																											
31				Bit 13: Sub-package, Reserved, Default is 0																																							`				
32				Bit 12-10: Encryption, Reserved, Default is 0																																											
33				Bit 9-0: Length of message body																																					Total mileage						
34																																															
35																																								Additional information length							
36																																															
37																																							Additional information ID, additional information can be configured whether to report								
```

**Проверка листа:**

- Непустых строк: 27
- Непустых ячеек в исходнике: 156; выгружено в TSV: 156 → совпадает, содержимое извлечено полностью
- Из них числовых (int) ячеек: 47; остальные — строки
- Не представимо текстом корректно: оформление ячеек (заливка, границы, шрифты) и rich-text внутри ячеек не передаются; гиперссылки B1→summary!A1 и F1→Introduction!A1 (адрес ссылки не виден в тексте ячейки); раскладка ячеек на сетке (позиции полей по столбцам) сохранена только через координаты

### 2.8. Лист `0x8001`

- Статус: **visible**
- Объявленный диапазон: `A1:X31`; фактические данные: `B1:U22`
- Исходные заголовки: строки 3, 5, 6, 7
- Объединённые ячейки: всего 25; с текстом/значением в левой верхней ячейке — 24; без значения (только оформление) — 1.
- Скрытых строк и столбцов нет.

Объединённые диапазоны со значением (значение принадлежит всему диапазону; сама ячейка — левая верхняя):

```tsv
range	value
B1:E1	Back to summary
B3:B5	Flag
C3:N4	Message Header
O3:S4	Message Body
T3:T5	Checksum Code
U3:U5	Flag
C5:D5	Message ID
E5:F5	Message Body Properties
G5:L5	Device ID
M5:N5	Message Sequence Number
O5:P5	Response Sequence Number
Q5:R5	Message ID
C6:D6	HEX\n(2 bytes)
E6:F6	HEX\n(2 bytes)
G6:L6	HEX\n(6 bytes)
M6:N6	HEX\n(2 bytes)
O6:P6	HEX\n(2 bytes)
Q6:R6	HEX\n(2 bytes)
G10:L14	The last 12 digits of IMEI number and converts it into BCD code
S12:W17	0: Success\n1: Fail\n2: Wrong message\n3: Not support\n4: Alarm confirmed
E18:I18	Bit 15: Reserved, Default is 0
E19:L19	Bit 14: Reserved, Default is 0
E20:I20	Bit 13: Sub-package, Reserved, Default is 0
E21:I21	Bit 12-10: Encryption, Reserved, Default is 0
```

Объединённые диапазоны без значения:

```
J18:L18
```

**Часть 1/1 — диапазон `B1:U22`**

```tsv
row	B	C	D	E	F	G	H	I	J	K	L	M	N	O	P	Q	R	S	T	U
1	Back to summary				Introduction!A1															
2	Server General Response (0x8001)																			
3	Flag	Message Header												Message Body					Checksum Code	Flag
4																				
5		Message ID		Message Body Properties		Device ID						Message Sequence Number		Response Sequence Number		Message ID		Result		
6	HEX\n(1 byte)	HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(1 byte)	HEX\n(1 byte)	HEX\n(1 byte)
7	1	2	3	4	5	6	7	8	9	10	11	12	13	14	15	16	17	18	19	20
8	0x7E	0x80	0x01	0x00	0x05	0x22	0x10	0x42	0x21	0x43	0x28	0x00	0x01	0x00	0x01	0x02	0x00	0x00	0xB9	0x7E
9																				
10						The last 12 digits of IMEI number and converts it into BCD code														
11																				
12																		0: Success\n1: Fail\n2: Wrong message\n3: Not support\n4: Alarm confirmed		
13																				
14																				
15																				
16																				
17																				
18				Bit 15: Reserved, Default is 0																
19				Bit 14: Reserved, Default is 0												ID of the corresponding device message 				
20				Bit 13: Sub-package, Reserved, Default is 0																
21				Bit 12-10: Encryption, Reserved, Default is 0										Sequence number of the corresponding device message 						
22				Bit 9-0: Length of message body																
```

**Проверка листа:**

- Непустых строк: 14
- Непустых ячеек в исходнике: 74; выгружено в TSV: 74 → совпадает, содержимое извлечено полностью
- Из них числовых (int) ячеек: 20; остальные — строки
- Не представимо текстом корректно: оформление ячеек (заливка, границы, шрифты) и rich-text внутри ячеек не передаются; гиперссылки B1→summary!A1 и F1→Introduction!A1 (адрес ссылки не виден в тексте ячейки); раскладка ячеек на сетке (позиции полей по столбцам) сохранена только через координаты

### 2.9. Лист `0x8100`

- Статус: **hidden**
- Объявленный диапазон: `A1:AH29`; фактические данные: `B1:AE20`
- Исходные заголовки: строки 3, 4, 5
- Объединённые ячейки: всего 19; с текстом/значением в левой верхней ячейке — 18; без значения (только оформление) — 1.
- Скрытых строк и столбцов нет.

Объединённые диапазоны со значением (значение принадлежит всему диапазону; сама ячейка — левая верхняя):

```tsv
range	value
B1:E1	Back to summary
C3:D3	Message ID
E3:F3	Properties of \nMessage\n Body
G3:L3	Device Number
M3:N3	Message Sequence Number
O3:P3	Reply Sequence  Number
R3:AC3	Authentication Code
C4:D4	HEX\n(2 bytes)
E4:F4	HEX\n(2 bytes)
G4:L4	HEX\n(6 bytes)
M4:N4	HEX\n(2 bytes)
O4:P4	HEX\n(2 bytes)
R4:AC4	HEX\n(n bytes)
G8:L12	If the device number is not configured:\nit takes the last 12 digits of IMEI number and converts it into BCD code
E16:I16	Bit 15: sub-package,reserved, default is 0
E17:L17	Bit14: this bit is reserved as 0 by default
E18:I18	Bit 13: sub-package,reserved, default is 0
E19:I19	Bit 12-10: encryption, reserved, default is 0
```

Объединённые диапазоны без значения:

```
J16:L16
```

**Часть 1/1 — диапазон `B1:AE20`**

```tsv
row	B	C	D	E	F	G	H	I	J	K	L	M	N	O	P	Q	R	S	T	U	V	W	X	Y	Z	AA	AB	AC	AD	AE
1	Back to summary				Introduction!A1																									
2	Device Registration Response (0x8100)																													
3	Flag	Message ID		Properties of \nMessage\n Body		Device Number						Message Sequence Number		Reply Sequence  Number		Result	Authentication Code												Checksum Code	Flag
4	HEX\n(1 byte)	HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(1 byte)	HEX\n(n bytes)												HEX\n(1 byte)	HEX\n(1 byte)
5	1	2	3	4	5	6	7	8	9	10	11	12	13	14	15	16	17	18	19	20	21	22	23	24	25	26	27	28	29	30
6	0x7E	0x81	0x00	0x00	0x0F	0x22	0x10	0x42	0x21	0x43	0x28	0x00	0x01	0x00	0x01	0x00	0x32	0x32	0x31	0x30	0x34	0x32	0x32	0x31	0x34	0x33	0x32	0x38	0x3F	0x7E
7																														
8						If the device number is not configured:\nit takes the last 12 digits of IMEI number and converts it into BCD code																								
9																														
10																														
11																														
12																	This field only after the successful registration													
13																														
14																0: Success														
15																1: The vehicle has been registered														
16				Bit 15: sub-package,reserved, default is 0												2: No the vehicle in database 														
17				Bit14: this bit is reserved as 0 by default												3: The device has been \nregistered 														
18				Bit 13: sub-package,reserved, default is 0												4: No device in the database														
19				Bit 12-10: encryption, reserved, default is 0																										
20				Bit 9-0: length of message body										Corresponding device message serial number																
```

**Проверка листа:**

- Непустых строк: 15
- Непустых ячеек в исходнике: 96; выгружено в TSV: 96 → совпадает, содержимое извлечено полностью
- Из них числовых (int) ячеек: 30; остальные — строки
- Не представимо текстом корректно: оформление ячеек (заливка, границы, шрифты) и rich-text внутри ячеек не передаются; гиперссылки B1→summary!A1 и F1→Introduction!A1 (адрес ссылки не виден в тексте ячейки); раскладка ячеек на сетке (позиции полей по столбцам) сохранена только через координаты

### 2.10. Лист `0x8103`

- Статус: **visible**
- Объявленный диапазон: `A1:BW79`; фактические данные: `B1:AA78`
- Исходные заголовки: строки 3, 5, 6, 7 (формат сообщения); строка 27 (Table 1: Parameters | Parameter ID | Parameter Type | Parameter Length | Unit | Type)
- Объединённые ячейки: всего 392; с текстом/значением в левой верхней ячейке — 367; без значения (только оформление) — 25.
- Скрытые строки: [38, 51, 52]; скрытые столбцы: нет. Непустые ячейки в них (выгружены ниже наравне с остальными): B38, G38, I38, K38, M38, O38, Q38, B51, G51, I51, K51, M51, O51, Q51, B52, G52, I52, K52, M52, O52

Объединённые диапазоны со значением (значение принадлежит всему диапазону; сама ячейка — левая верхняя):

```tsv
range	value
B1:E1	Back to summary
B3:B5	Flag
C3:N4	Message Header
O3:Y4	Message Body
Z3:Z5	Checksum Code
AA3:AA5	Flag
C5:D5	Message ID
E5:F5	Message Body Properties
G5:L5	Device ID
M5:N5	Message Sequence Number
O5:P5	Total Number Of Parameters
Q5:T5	Parameter ID
V5:Y5	Parameter Value
C6:D6	HEX\n(2 bytes)
E6:F6	HEX\n(2 bytes)
G6:L6	HEX\n(6 bytes)
M6:N6	HEX\n(2 bytes)
O6:P6	HEX\n(1 byte)
Q6:T6	HEX\n(4 byte)
V6:Y6	HEX\n(<=250 bytes)
O7:P7	14
O8:P8	0x01
G10:L14	The last 12 digits of IMEI number and converts it into BCD code
E18:I18	Bit 15: Reserved, Default is 0
E19:L19	Bit 14: Reserved, Default is 0
E20:I20	Bit 13: Sub-package, Reserved, Default is 0
E21:I21	Bit 12-10: Encryption, Reserved, Default is 0
B27:F27	Parameters
G27:H27	Parameter ID
I27:J27	Parameter Type
K27:L27	Parameter Length
M27:N27	Unit
O27:P27	Type
Q27:X27	 
B28:F28	APN username
G28:H28	0x0011
I28:J28	STRING
K28:L28	/
M28:N28	/
O28:P28	GA
B29:F29	APN password
G29:H29	0x0012
I29:J29	STRING
K29:L29	/
M29:N29	/
O29:P29	GA
B30:F30	Main server IP or domain name
G30:H30	0x0013
I30:J30	STRING
K30:L30	/
M30:N30	/
O30:P30	GA
Q30:X30	Support server IP or domain name
B31:F31	Backup server IP or domain name
G31:H31	0x0017
I31:J31	STRING
K31:L31	/
M31:N31	/
O31:P31	GA
Q31:X31	Support server IP or domain name
B32:F32	Main server TCP or UDP port
G32:H32	0x0018
I32:J32	DWORD
K32:L32	4
M32:N32	/
O32:P32	GA
Q32:X32	TCP or UDP port
B33:F33	Device ID
G33:H33	0xF000
I33:J33	STRING
K33:L33	/
M33:N33	/
O33:P33	GA
Q33:X33	The max BCD code is 12 by default.
B34:F34	NTP server address
G34:H34	0xF004
I34:J34	STRING
K34:L34	/
M34:N34	/
O34:P34	GA
Q34:X34	Support domain name and IP.
B35:F35	NTP server port
G35:H35	0xF005
I35:J35	DWORD
K35:L35	4
M35:N35	/
O35:P35	GA
B36:F36	Timezone
G36:H36	0xF006
I36:J36	BYTE
K36:L36	1
M36:N36	/
O36:P36	GA
Q36:X36	[-12,12]
B37:F37	Protocol type
G37:H37	0xF007
I37:J37	BYTE
K37:L37	1
M37:N37	/
O37:P37	GA
Q37:X37	[0:JTT808  1:TAIP]
B38:F38	The version of protocol
G38:H38	0xF008
I38:J38	BYTE
K38:L38	1
M38:N38	/
O38:P38	GA
Q38:X38	[0:2011 1:2013 2:2019]
B39:F39	Protocol encryption
G39:H39	0xF009
I39:J39	BYTE
K39:L39	1
M39:N39	/
O39:P39	GA
Q39:X39	[0:NULL 1:RSA 2:AES 3:XTEA]
B40:F40	Position Galaxy
G40:H40	0xF00A
I40:J40	BYTE
K40:L40	1
M40:N40	/
O40:P40	GA
Q40:X40	[0:GPS+BD 1:GPS+GLO 2:GPS+GAL]
B41:F41	WiFi enable
G41:H41	0xF00B
I41:J41	BYTE
K41:L41	1
M41:N41	/
O41:P41	GA
Q41:X41	[0:off  1:on]
B42:F42	WiFi work mode*
G42:H42	0xF00C
I42:J42	BYTE
K42:L42	1
M42:N42	/
O42:P42	GA
Q42:X42	[0:AP 1:STA]
B43:F43	The max AP of WiFi
G43:H43	0xF00D
I43:J43	BYTE
K43:L43	1
M43:N43	/
O43:P43	GA
B44:F44	WiFi single scan time
G44:H44	0xF00E
I44:J44	WORD
K44:L44	2
M44:N44	second
O44:P44	GA
B45:F45	BT enable
G45:H45	0xF00F
I45:J45	BYTE
K45:L45	1
M45:N45	/
O45:P45	GA
Q45:X45	[0:off  1:open]
B46:F46	BT work mode
G46:H46	0xF010
I46:J46	BYTE
K46:L46	1
M46:N46	/
O46:P46	GA
Q46:X46	[0:host 1:slave]
B47:F47	Maximum number nodes of BT
G47:H47	0xF011
I47:J47	BYTE
K47:L47	1
M47:N47	/
O47:P47	GA
B48:F48	Scan timeout of Bluetooth sensors
G48:H48	0xF012
I48:J48	BYTE
K48:L48	1
M48:N48	minute
O48:P48	GA
Q48:X48	BT judges whether the node is offline through automatic scanning
B49:F49	Bluetooth single scan time
G49:H49	0xF013
I49:J49	WORD
K49:L49	2
M49:N49	second
O49:P49	GA
B50:F50	Bluetooth sensor report mask
G50:H50	0xF014
I50:J50	BYTE
K50:L50	1
M50:N50	/
O50:P50	GA
B51:F51	Input GPIO mode
G51:H51	0xF015
I51:J51	WORD
K51:L51	2
M51:N51	/
O51:P51	V
Q51:X51	High byte [channel number], low byte [0: digital 1: analog]
B52:F52	GPIO direction*
G52:H52	0xF016
I52:J52	BYTE
K52:L52	1
M52:N52	/
O52:P52	V
B53:F53	Communication protocol
G53:H53	0xF017
I53:J53	BYTE
K53:L53	1
M53:N53	/
O53:P53	GA
Q53:X53	[0:TCP 1:UDP 2:MQTT]
B54:F54	Report mask
G54:H54	0xF018
I54:J54	DWORD
K54:L54	4
M54:N54	/
O54:P54	GA
B55:F55	Accelerometer enable
G55:H55	0xF019
I55:J55	BYTE
K55:L55	1
M55:N55	/
O55:P55	GA
Q55:X55	[0:off  1:on]
B56:F56	Accelerometer sensitivity
G56:H56	0xF01A
I56:J56	BYTE
K56:L56	1
M56:N56	/
O56:P56	GA
Q56:X56	[0-255]
B57:F57	Accelerometer range
G57:H57	0xF01B
I57:J57	BYTE
K57:L57	1
M57:N57	/
O57:P57	GA
Q57:X57	[0:2g 1:4g 2:8g 3:16g]
B58:F58	Accelerometer motion times
G58:H58	0xF01C
I58:J58	WORD
K58:L58	2
M58:N58	/
O58:P58	GA
B59:F59	Accelerometer motion duration
G59:H59	0xF01D
I59:J59	DWORD
K59:L59	4
M59:N59	second
O59:P59	GA
B60:F60	Accelerometer trigger event interval
G60:H60	0xF01E
I60:J60	DWORD
K60:L60	4
M60:N60	second
O60:P60	GA
B61:F61	Accelerometer report mask
G61:H61	0xF01F
I61:J61	BYTE
K61:L61	1
M61:N61	/
O61:P61	GA
B62:F62	Light sensor enable
G62:H62	0xF020
I62:J62	BYTE
K62:L62	1
M62:N62	/
O62:P62	GA
Q62:X62	[0:off  1:on]
B63:F63	Light sensor threshold
G63:H63	0xF021
I63:J63	WORD
K63:L63	2
M63:N63	/
O63:P63	GA
B64:F64	Light trigger event interval
G64:H64	0xF022
I64:J64	DWORD
K64:L64	4
M64:N64	second
O64:P64	GA
B65:F65	Temperature & humidity enable
G65:H65	0xF023
I65:J65	BYTE
K65:L65	1
M65:N65	/
O65:P65	G
Q65:X65	[0:off  1:on]
B66:F66	Upper temperature limit
G66:H66	0xF024
I66:J66	WORD
K66:L66	2
M66:N66	/
O66:P66	G
B67:F67	Lower temperature limit
G67:H67	0xF025
I67:J67	WORD
K67:L67	2
M67:N67	/
O67:P67	G
B68:F68	Upper humidity limit
G68:H68	0xF026
I68:J68	WORD
K68:L68	2
M68:N68	/
O68:P68	G
B69:F69	Lower humidity limit
G69:H69	0xF027
I69:J69	WORD
K69:L69	2
M69:N69	/
O69:P69	G
B70:F70	Temperature & humidity trigger event interval
G70:H70	0xF028
I70:J70	DWORD
K70:L70	4
M70:N70	second
O70:P70	G
B71:F71	GNSS enable
G71:H71	0xF029
I71:J71	BYTE
K71:L71	1
M71:N71	/
O71:P71	GA
Q71:X71	[0:off  1:on]
B72:F72	Device working mode 
G72:H72	0xF02A
I72:J72	BYTE
K72:L72	1
M72:N72	/
O72:P72	GA
B73:F73	Backup server port
G73:H73	0xF02B
I73:J73	DWORD
K73:L73	4
M73:N73	/
O73:P73	GA
Q73:X73	TCP or UDP port
B74:F74	Buffer enable
G74:H74	0xF02C
I74:J74	BYTE
K74:L74	1
M74:N74	/
O74:P74	GA
Q74:X74	[0:off  1:on]
B75:F75	Server acknowledge enable
G75:H75	0xF02D
I75:J75	BYTE
K75:L75	1
M75:N75	/
O75:P75	GA
Q75:X75	[0:off  1:on]
B76:F76	Reporting Interval
G76:H76	0xF02E
I76:J76	DWORD
K76:L76	4
M76:N76	second
O76:P76	GA
B77:F77	Sampling Interval
G77:H77	0xF02F
I77:J77	DWORD
K77:L77	4
M77:N77	second
O77:P77	GA
B78:F78	AT command transparent transmission
G78:H78	0xF030
I78:J78	STRING
K78:L78	/
M78:N78	/
O78:P78	GA
Q78:X78	More details find in AT commands
```

Объединённые диапазоны без значения:

```
J18:L18, Q28:X28, Q29:X29, Q35:X35, Q43:X43, Q44:X44, Q47:X47, Q49:X49, Q50:X50, Q52:X52, Q54:X54, Q58:X58, Q59:X59, Q60:X60, Q61:X61, Q63:X63, Q64:X64, Q66:X66, Q67:X67, Q68:X68, Q69:X69, Q70:X70, Q72:X72, Q76:X76, Q77:X77
```

**Часть 1/1 — диапазон `B1:AA78`**

```tsv
row	B	C	D	E	F	G	H	I	J	K	L	M	N	O	P	Q	R	S	T	U	V	W	X	Y	Z	AA
1	Back to summary				Introduction!A1																					
2	Configuration Commands Parameters (0x8103)																									
3	Flag	Message Header												Message Body											Checksum Code	Flag
4																										
5		Message ID		Message Body Properties		Device ID						Message Sequence Number		Total Number Of Parameters		Parameter ID				Parameter Length	Parameter Value					
6	HEX\n(1 byte)	HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(2 bytes)		HEX\n(1 byte)		HEX\n(4 byte)				HEX\n(1 byte)	HEX\n(<=250 bytes)				HEX\n(1 byte)	HEX\n(1 byte)
7	1	2	3	4	5	6	7	8	9	10	11	12	13	14		15	16	17	18	19	20	21	22	23	24	25
8	0x7E	0x81	0x03	0x00	0x0F	0x22	0x10	0x42	0x21	0x43	0x28	0x00	0x01	0x01		0x00	0x00	0x00	0x01	0x04	0x00	0x00	0x00	0x1D	0x3F	0x7E
9																										
10						The last 12 digits of IMEI number and converts it into BCD code																				
11																										
12																										
13																										
14																										
15																										
16																Refer to below table 1										
17																										
18				Bit 15: Reserved, Default is 0																						
19				Bit 14: Reserved, Default is 0																						
20				Bit 13: Sub-package, Reserved, Default is 0																						
21				Bit 12-10: Encryption, Reserved, Default is 0																						
22				Bit 9-0: Length of message body																						
23																										
24																										
25	Table 1																									
26	Remark:  GA in Type means applicable to GA series devices . V means applicable to V series devices Like VL300 VG300 , GA means applicable to GA series devices , like GL100 AM300																									
27	Parameters					Parameter ID		Parameter Type		Parameter Length		Unit		Type		 										
28	APN username					0x0011		STRING		/		/		GA												
29	APN password					0x0012		STRING		/		/		GA												
30	Main server IP or domain name					0x0013		STRING		/		/		GA		Support server IP or domain name										
31	Backup server IP or domain name					0x0017		STRING		/		/		GA		Support server IP or domain name										
32	Main server TCP or UDP port					0x0018		DWORD		4		/		GA		TCP or UDP port										
33	Device ID					0xF000		STRING		/		/		GA		The max BCD code is 12 by default.										
34	NTP server address					0xF004		STRING		/		/		GA		Support domain name and IP.										
35	NTP server port					0xF005		DWORD		4		/		GA												
36	Timezone					0xF006		BYTE		1		/		GA		[-12,12]										
37	Protocol type					0xF007		BYTE		1		/		GA		[0:JTT808  1:TAIP]										
38	The version of protocol					0xF008		BYTE		1		/		GA		[0:2011 1:2013 2:2019]										
39	Protocol encryption					0xF009		BYTE		1		/		GA		[0:NULL 1:RSA 2:AES 3:XTEA]										
40	Position Galaxy					0xF00A		BYTE		1		/		GA		[0:GPS+BD 1:GPS+GLO 2:GPS+GAL]										
41	WiFi enable					0xF00B		BYTE		1		/		GA		[0:off  1:on]										
42	WiFi work mode*					0xF00C		BYTE		1		/		GA		[0:AP 1:STA]										
43	The max AP of WiFi					0xF00D		BYTE		1		/		GA												
44	WiFi single scan time					0xF00E		WORD		2		second		GA												
45	BT enable					0xF00F		BYTE		1		/		GA		[0:off  1:open]										
46	BT work mode					0xF010		BYTE		1		/		GA		[0:host 1:slave]										
47	Maximum number nodes of BT					0xF011		BYTE		1		/		GA												
48	Scan timeout of Bluetooth sensors					0xF012		BYTE		1		minute		GA		BT judges whether the node is offline through automatic scanning										
49	Bluetooth single scan time					0xF013		WORD		2		second		GA												
50	Bluetooth sensor report mask					0xF014		BYTE		1		/		GA												
51	Input GPIO mode					0xF015		WORD		2		/		V		High byte [channel number], low byte [0: digital 1: analog]										
52	GPIO direction*					0xF016		BYTE		1		/		V												
53	Communication protocol					0xF017		BYTE		1		/		GA		[0:TCP 1:UDP 2:MQTT]										
54	Report mask					0xF018		DWORD		4		/		GA												
55	Accelerometer enable					0xF019		BYTE		1		/		GA		[0:off  1:on]										
56	Accelerometer sensitivity					0xF01A		BYTE		1		/		GA		[0-255]										
57	Accelerometer range					0xF01B		BYTE		1		/		GA		[0:2g 1:4g 2:8g 3:16g]										
58	Accelerometer motion times					0xF01C		WORD		2		/		GA												
59	Accelerometer motion duration					0xF01D		DWORD		4		second		GA												
60	Accelerometer trigger event interval					0xF01E		DWORD		4		second		GA												
61	Accelerometer report mask					0xF01F		BYTE		1		/		GA												
62	Light sensor enable					0xF020		BYTE		1		/		GA		[0:off  1:on]										
63	Light sensor threshold					0xF021		WORD		2		/		GA												
64	Light trigger event interval					0xF022		DWORD		4		second		GA												
65	Temperature & humidity enable					0xF023		BYTE		1		/		G		[0:off  1:on]										
66	Upper temperature limit					0xF024		WORD		2		/		G												
67	Lower temperature limit					0xF025		WORD		2		/		G												
68	Upper humidity limit					0xF026		WORD		2		/		G												
69	Lower humidity limit					0xF027		WORD		2		/		G												
70	Temperature & humidity trigger event interval					0xF028		DWORD		4		second		G												
71	GNSS enable					0xF029		BYTE		1		/		GA		[0:off  1:on]										
72	Device working mode 					0xF02A		BYTE		1		/		GA												
73	Backup server port					0xF02B		DWORD		4		/		GA		TCP or UDP port										
74	Buffer enable					0xF02C		BYTE		1		/		GA		[0:off  1:on]										
75	Server acknowledge enable					0xF02D		BYTE		1		/		GA		[0:off  1:on]										
76	Reporting Interval					0xF02E		DWORD		4		second		GA												
77	Sampling Interval					0xF02F		DWORD		4		second		GA												
78	AT command transparent transmission					0xF030		STRING		/		/		GA		More details find in AT commands										
```

**Проверка листа:**

- Непустых строк: 68
- Непустых ячеек в исходнике: 426; выгружено в TSV: 426 → совпадает, содержимое извлечено полностью
- Из них числовых (int) ячеек: 69; остальные — строки
- Не представимо текстом корректно: оформление ячеек (заливка, границы, шрифты) и rich-text внутри ячеек не передаются; гиперссылки B1→summary!A1 и F1→Introduction!A1 (адрес ссылки не виден в тексте ячейки); раскладка ячеек на сетке (позиции полей по столбцам) сохранена только через координаты

### 2.11. Лист `0x8104`

- Статус: **visible**
- Объявленный диапазон: `A1:XFC34`; фактические данные: `B1:P22`
- Исходные заголовки: строки 3, 5, 6, 7
- Объединённые ячейки: всего 19; с текстом/значением в левой верхней ячейке — 18; без значения (только оформление) — 1.
- Скрытых строк и столбцов нет.

Объединённые диапазоны со значением (значение принадлежит всему диапазону; сама ячейка — левая верхняя):

```tsv
range	value
B1:E1	Back to summary
B3:B5	Flag
C3:N4	Message Header
O3:O5	Checksum Code
P3:P5	Flag
C5:D5	Message ID
E5:F5	Message Body Properties
G5:L5	Device ID
M5:N5	Message Sequence Number
C6:D6	HEX\n(2 bytes)
E6:F6	HEX\n(2 bytes)
G6:L6	HEX\n(6 bytes)
M6:N6	HEX\n(2 bytes)
G10:L14	The last 12 digits of IMEI number and converts it into BCD code
E18:I18	Bit 15: Reserved, Default is 0
E19:L19	Bit 14: Reserved, Default is 0
E20:I20	Bit 13: Sub-package, Reserved, Default is 0
E21:I21	Bit 12-10: Encryption, Reserved, Default is 0
```

Объединённые диапазоны без значения:

```
J18:L18
```

**Часть 1/1 — диапазон `B1:P22`**

```tsv
row	B	C	D	E	F	G	H	I	J	K	L	M	N	O	P
1	Back to summary				Introduction!A1										
2	Query Command Parameters (0x8104)														
3	Flag	Message Header												Checksum Code	Flag
4															
5		Message ID		Message Body Properties		Device ID						Message Sequence Number			
6	HEX\n(1 byte)	HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(2 bytes)		HEX\n(1 byte)	HEX\n(1 byte)
7	1	2	3	4	5	6	7	8	9	10	11	12	13	14	15
8	0x7E	0x81	0x04	0x00	0x00	0x22	0x10	0x42	0x21	0x43	0x28	0x00	0x07	0x3F	0x7E
9															
10						The last 12 digits of IMEI number and converts it into BCD code									
11															
12															
13															
14															
15															
16															
17															
18				Bit 15: Reserved, Default is 0											
19				Bit 14: Reserved, Default is 0											
20				Bit 13: Sub-package, Reserved, Default is 0											
21				Bit 12-10: Encryption, Reserved, Default is 0											
22				Bit 9-0: Length of message body											
```

**Проверка листа:**

- Непустых строк: 13
- Непустых ячеек в исходнике: 54; выгружено в TSV: 54 → совпадает, содержимое извлечено полностью
- Из них числовых (int) ячеек: 15; остальные — строки
- Не представимо текстом корректно: оформление ячеек (заливка, границы, шрифты) и rich-text внутри ячеек не передаются; гиперссылки B1→summary!A1 и F1→Introduction!A1 (адрес ссылки не виден в тексте ячейки); раскладка ячеек на сетке (позиции полей по столбцам) сохранена только через координаты

### 2.12. Лист `0x8900`

- Статус: **hidden**
- Объявленный диапазон: `A1:XEY36`; фактические данные: `B1:R22`
- Исходные заголовки: строки 3, 4, 5
- Объединённые ячейки: всего 16; с текстом/значением в левой верхней ячейке — 15; без значения (только оформление) — 1.
- Скрытых строк и столбцов нет.

Объединённые диапазоны со значением (значение принадлежит всему диапазону; сама ячейка — левая верхняя):

```tsv
range	value
B1:E1	Back to summary
C3:D3	Message ID
E3:F3	Properties of \nMessage\n Body
G3:L3	Device Number
M3:N3	Message Sequence Number
C4:D4	HEX\n(2 bytes)
E4:F4	HEX\n(2 bytes)
G4:L4	HEX\n(6 bytes)
M4:N4	HEX\n(2 bytes)
P7:P15	n bytes\nASCII code,length less than 1023 bytes; refer to the  AT commands
G8:L12	If the device number is not configured:\nit takes the last 12 digits of IMEI number and converts it into BCD code
E16:I16	Bit 15: sub-package,reserved, default is 0
E17:L17	Bit14: this bit is reserved as 0 by default
E18:I18	Bit 13: sub-package,reserved, default is 0
E19:I19	Bit 12-10: encryption, reserved, default is 0
```

Объединённые диапазоны без значения:

```
J16:L16
```

**Часть 1/1 — диапазон `B1:R22`**

```tsv
row	B	C	D	E	F	G	H	I	J	K	L	M	N	O	P	Q	R
1	Back to summary				Introduction!A1												
2	Downlink Transparent Transmission (0x8900)																
3	Flag	Message ID		Properties of \nMessage\n Body		Device Number						Message Sequence Number		Transparent Transmission Type	Transparent Transmission Data	Checksum Code	Flag
4	HEX\n(1 byte)	HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(2 bytes)		HEX\n(1 byte)	HEX\n(n byte)	HEX\n(1 byte)	HEX\n(1 byte)
5	1	2	3	4	5	6	7	8	9	10	11	12	13	14	15	16	17
6	0x7E	0x89	0x00	0x00	0x0F	0x22	0x10	0x42	0x21	0x43	0x28	0x00	0x01	0x41	0x00	0x3F	0x7E
7															n bytes\nASCII code,length less than 1023 bytes; refer to the  AT commands		
8						If the device number is not configured:\nit takes the last 12 digits of IMEI number and converts it into BCD code											
9																	
10																	
11																	
12																	
13																	
14																	
15																	
16				Bit 15: sub-package,reserved, default is 0													
17				Bit14: this bit is reserved as 0 by default													
18				Bit 13: sub-package,reserved, default is 0													
19				Bit 12-10: encryption, reserved, default is 0													
20				Bit 9-0: length of message body													
21														0x41:UART1			
22														0x42:UART2			
```

**Проверка листа:**

- Непустых строк: 15
- Непустых ячеек в исходнике: 64; выгружено в TSV: 64 → совпадает, содержимое извлечено полностью
- Из них числовых (int) ячеек: 17; остальные — строки
- Не представимо текстом корректно: оформление ячеек (заливка, границы, шрифты) и rich-text внутри ячеек не передаются; гиперссылки B1→summary!A1 и F1→Introduction!A1 (адрес ссылки не виден в тексте ячейки); раскладка ячеек на сетке (позиции полей по столбцам) сохранена только через координаты

### 2.13. Лист `0x8A00`

- Статус: **hidden**
- Объявленный диапазон: `A1:AC29`; фактические данные: `B1:T20`
- Исходные заголовки: строки 3, 4, 5
- Объединённые ячейки: всего 24; с текстом/значением в левой верхней ячейке — 22; без значения (только оформление) — 2.
- Скрытых строк и столбцов нет.

Объединённые диапазоны со значением (значение принадлежит всему диапазону; сама ячейка — левая верхняя):

```tsv
range	value
B1:E1	Back to summary
C3:D3	Message ID
E3:F3	Properties of \nMessage\n Body
G3:L3	Device Number
M3:N3	Message Sequence Number
O3:P3	E
Q3:R3	N
C4:D4	HEX\n(2 bytes)
E4:F4	HEX\n(2 bytes)
G4:L4	HEX\n(6 bytes)
M4:N4	HEX\n(2 bytes)
O4:P4	HEX\n(4 bytes)
Q4:R4	HEX\n(128 bytes)
O5:P5	14-17
Q5:R5	18-145
O6:P6	-
Q6:R6	-
G8:L12	If the device number is not configured:\nit takes the last 12 digits of IMEI number and converts it into BCD code
E16:I16	Bit 15: sub-package,reserved, default is 0
E17:L17	Bit14: this bit is reserved as 0 by default
E18:I18	Bit 13: sub-package,reserved, default is 0
E19:I19	Bit 12-10: encryption, reserved, default is 0
```

Объединённые диапазоны без значения:

```
O8:AC16, J16:L16
```

**Часть 1/1 — диапазон `B1:T20`**

```tsv
row	B	C	D	E	F	G	H	I	J	K	L	M	N	O	P	Q	R	S	T
1	Back to summary				Introduction!A1														
2	Platform RSA Public Key (0x8A00)																		
3	Flag	Message ID		Properties of \nMessage\n Body		Device Number						Message Sequence Number		E		N		Checksum Code	Flag
4	HEX\n(1 byte)	HEX\n(2 bytes)		HEX\n(2 bytes)		HEX\n(6 bytes)						HEX\n(2 bytes)		HEX\n(4 bytes)		HEX\n(128 bytes)		HEX\n(1 byte)	HEX\n(1 byte)
5	1	2	3	4	5	6	7	8	9	10	11	12	13	14-17		18-145		146	147
6	0x7E	0x8A	0x00	0x00	0x0F	0x22	0x10	0x42	0x21	0x43	0x28	0x00	0x01	-		-		0x3F	0x7E
7																			
8						If the device number is not configured:\nit takes the last 12 digits of IMEI number and converts it into BCD code													
9																			
10																			
11																			
12																			
13																			
14																			
15																			
16				Bit 15: sub-package,reserved, default is 0															
17				Bit14: this bit is reserved as 0 by default															
18				Bit 13: sub-package,reserved, default is 0															
19				Bit 12-10: encryption, reserved, default is 0															
20				Bit 9-0: length of message body															
```

**Проверка листа:**

- Непустых строк: 12
- Непустых ячеек в исходнике: 61; выгружено в TSV: 61 → совпадает, содержимое извлечено полностью
- Из них числовых (int) ячеек: 15; остальные — строки
- Не представимо текстом корректно: оформление ячеек (заливка, границы, шрифты) и rich-text внутри ячеек не передаются; гиперссылки B1→summary!A1 и F1→Introduction!A1 (адрес ссылки не виден в тексте ячейки); раскладка ячеек на сетке (позиции полей по столбцам) сохранена только через координаты
