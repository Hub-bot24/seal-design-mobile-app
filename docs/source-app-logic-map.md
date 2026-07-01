[source-app-logic-map.md](https://github.com/user-attachments/files/29532436/source-app-logic-map.md)
# App logic map — Seal Design

This is the practical extraction for converting the workbook into a phone/web app. It uses only `Calculation` and `Lookups ` and ignores all other sheets.

## Hard facts extracted

- `Calculation`: used range `A2:CE252`, 702 non-empty/formula cells, 79 formula cells, 23 dropdown/validation rules.
- `Lookups `: used range `A1:AK506`, 2282 non-empty/formula cells, 472 formula cells, 0 dropdown/validation rules.

## Structured lookup tables found

- `LookupsTbl` `B1:J118`: 117 rows; columns: `A (Agg Size 1)`, `B (Agg Size 2)`, `C (Min Sand Patch)`, `D (Max Sand Patch)`, `E (Value)`, `E_num`, `KeyA`, `KeyB`, `Column1`
- `LUT_Factors` `A183:E272`: 89 rows; columns: `Spec`, `BF_Type`, `BF_Treatment`, `BF_Binder`, `BF_Result`
- `LUT_Factors4` `A278:E372`: 94 rows; columns: `Spec`, `BF_Type`, `BF_Treatment`, `BF_Binder`, `BF_Result`

## Calculation input candidates from dropdown/data validation

- `BV106` — From Filterd list; current `Medium porosity`; validation `$BT$100:$BT$106`
- `BW106` — Medium porosity; current ``; validation `$BT$100:$BT$106`
- `BX106` — Medium porosity; current ``; validation `$BT$100:$BT$106`
- `BY106` — Medium porosity; current ``; validation `$BT$100:$BT$106`
- `BZ106` — Medium porosity; current ``; validation `$BT$100:$BT$106`
- `CA106` — Medium porosity; current ``; validation `$BT$100:$BT$106`
- `CB106` — Medium porosity; current ``; validation `$BT$100:$BT$106`
- `CC106` — [no nearby label found]; current ``; validation `$BT$100:$BT$106`
- `K38` — L/m²; current `10mm`; validation `"5 & 7mm,10mm,14mm and Greater"`
- `U38` — mm; current `10mm`; validation `"5 & 7mm,10mm,14mm and Greater"`
- `U45` — GRADIENT; current `Flat or Downhill`; validation `"Flat or Downhill,Slow moving - Climbing Lanes"`
- `K45` — m2/m3; current `Flat or Downhill`; validation `"Flat or Downhill,Slow moving - Climbing Lanes"`
- `N45` — Flat or Downhill; current `No`; validation `"Yes,No"`
- `X45` — Flat or Downhill; current `No`; validation `"Yes,No"`
- `P26` — N/A; current `1`; validation `"N/A,1,2,3,>3"`
- `Z26` — 10mm; current `N/A`; validation `"N/A,1,2,3,>3"`
- `K20` — Adjustments:; current `TN175`; validation `$BH$38:$BI$38`
- `X20` — SPEC; current `AGPT04K-18`; validation `$BH$38:$BI$38`
- `BT95` — [no nearby label found]; current `PRIME`; validation `$BM$39:$BM$58`
- `BU95` — PRIME; current ``; validation `$BM$39:$BM$58`
- `X32` — Double 2nd Coat; current `Primer`; validation `$BM$39:$BM$58`
- `X31` — TYPE; current `TREATMENT`; validation `$CY$50:$CZ$50`
- `X32` — Double 2nd Coat; current `Primer`; validation `$CY$50:$CZ$50`
- `N31` — TYPE; current `TREATMENT`; validation `$CY$50:$CZ$50`
- `K19` — Vf; current `SPEC`; validation `"Granular Unbound, Cementitious Binders,Bitumen Stabilised, Chemical Binders"`
- `U19` — [no nearby label found]; current `SPEC`; validation `"Granular Unbound, Cementitious Binders,Bitumen Stabilised, Chemical Binders"`
- `N5` — AWDT; current `0.5`; validation `ISBLANK(#REF!)`
- `X5` — AADT; current `0.5`; validation `ISBLANK(#REF!)`
- `U32` — S15R; current `Double 2nd Coat`; validation `"Single,Double 1st Coat, Double 2nd Coat"`
- `BF8` — [no nearby label found]; current `N/A`; validation `"Granular,Primed,5 & 7mm,10mm, 14 & 16 & 20mm,MicroSurfacing/Asphalt,N/A"`
- `R52` — [no nearby label found]; current ``; validation `"Overcast, Partly Cloudy,Full Sun"`
- `U52` — [no nearby label found]; current ``; validation `"Calm,Moderate,Strong"`
- `K52` — Spray Seal; current ``; validation `"Cold <16 C,Mild 16 -20 C, Warm 21-25C,Hot 26-30C,Very Hot 31-35C,Extreme Heat >35"`
- `Z32` — Primer; current `AMC00`; validation `$AY$135:$AY$143`
- `K42` — NOT Profiled asphalt; current ``; validation `"New / warm asphalt (un-milled),Cold-planed / milled asphalt,Extremely coarse/milled surface"`
- `A5` — [no nearby label found]; current ``; validation `"Tightly bonded,Medium porosity,Porous,Very porous,Hill gravels, granitic sands,Stabilised,Concrete"`
- `B5` — [no nearby label found]; current ``; validation `"Slow, Medium, Fast"`
- `G42` — L/m131; current `NOT Profiled asphalt`; validation `IF($G$41="Absorption",AbsorptionOptions,EmptyList)`
- `K50` — Final Wearing Coarce; current `Spray Seal`; validation `"Asphalt,Spray Seal"`
- `K26` — SURFACE; current `N/A`; validation `$BH$11:$BH$24`
- `L26` — N/A; current ``; validation `$BH$11:$BH$24`
- `M26` — N/A; current ``; validation `$BH$11:$BH$24`
- `K27` — mm; current ``; validation `$BH$11:$BH$24`
- `L27` — mm; current ``; validation `$BH$11:$BH$24`
- `M27` — mm; current ``; validation `$BH$11:$BH$24`
- `K28` — N/A; current ``; validation `$BH$11:$BH$24`
- `L28` — N/A; current ``; validation `$BH$11:$BH$24`
- `M28` — N/A; current ``; validation `$BH$11:$BH$24`
- `U26` — SURFACE; current `10mm`; validation `$BH$4:$BH$20`

## Formula groups to rebuild in code

These are not optional. If you build the app, these formula families must become JavaScript functions or you will just create a fragile spreadsheet clone.

- `F5` : `=INDEX([3]Lookups!$H$34:$H$60,MATCH(1,([3]Lookups!$K$34:$K$60=Calculation!K32)*([3]Lookups!$N$34:$N$60=Calculation!N32)*([3]Lookups!$P$34:$P$60=Calculation!P32),0))` → cached `#N/A`
- `J7` AADT (Calculated): `=ROUND(((J5*260)+(J6*105))/365,0)` → cached `1307`
- `AQ8` Conventional Seal: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(K32,$AM$7:$AO$7,$AM$8:$AO$21),,TRUE)` → cached `Conventional Seal`
- `A14` : `=IFERROR(
  _xlfn.XLOOKUP(
    1,
    ([3]Lookups!$B$2:$B$1000=Calculation!K32)*
    ([3]Lookups!$C$2:$C$1000=Calculation!N32)*
    ([3]Lookups!$D$2:$D$1000=Calculation!P32),
    [3]Lookups!$E$2:$E$1000
  ),
  ""
)` → cached `None`
- `N16` EHV (%: `=IFERROR((O8/N12)+(O9/N12*3),"N/A")` → cached `0`
- `H19` Vf: `=IF(H16="","",
 IF(OR(K32="single",K32="Armour coat"),
    IF(H16<=110,0.388*110^(-0.1304),
       IF(H16<=500,0.388*H16^(-0.1304),0.3687*H16^(-0.1226))
    ),
 IF(K32="double 2nd coat",
    IF(H16<=110,0.388*110^(-0.1304),
       IF(H16<=500,0.388*H16^(-0.1304),0.3687*H16^(-0.1226))
    ),
 IF(K32="double 1st coat",
    ROUND(IF(H16<=500,0.2359*H16^(-0.084),0.2385*H16^(-0.086)),3),
 ""
 ))))` → cached `0.14`
- `AG19` Vf: `=IF(U32="single",IF(AG16="","",(IF(AG16<=110,0.388*110^(-0.1304),IF(AG16<=500,0.388*AG16^(-0.1304),0.3687*AG16^-0.1226)))),IF(U32="double 2nd coat",IF(AG16="","",(IF(AG16<=110,0.388*110^(-0.1304),IF(AG16<=500,0.388*AG16^(-0.1304),0.3687*AG16^-0.1226)))),(IF(U32="double 1st coat",(ROUND(IF(AG16<=500,0.2359*AG16^(-0.084),0.2385*AG16^-0.086),3))))))` → cached `0.17278257063200295`
- `A25` : `=IF(OR($N$32="HaTelit",$K$32="Double 2nd Coat",$K$26="N/A",$N$32="HUESKER Chipseal Grid A10",$N$32="HUESKER Chipseal Grid A15"),
0,
SUMIFS(
LookupsTbl[E_num],
LookupsTbl[KeyA], UPPER(TRIM($K$26)),
LookupsTbl[KeyB], UPPER(TRIM($K$38)),
LookupsTbl[C (Min Sand Patch)], "<=" & N($K$26),
LookupsTbl[D (Max Sand Patch)], ">=" & N($K$26)
))` → cached `0`
- `A28` : `=IFERROR(
INDEX([3]Lookups!$E:$E,
MATCH(1,
([3]Lookups!$B:$B=K32)*
([3]Lookups!$C:$C=N32)*
([3]Lookups!$D:$D=P32),
0)
),
"")` → cached `None`
- `H31` BF: `=IFERROR(IF(SUMIFS(LUT_Factors[BF_Result],LUT_Factors[BF_Type],K32,LUT_Factors[BF_Treatment],N32,LUT_Factors[BF_Binder],P32)=0,"Select Binder",SUMIFS(LUT_Factors[BF_Result],LUT_Factors[BF_Type],K32,LUT_Factors[BF_Treatment],N32,LUT_Factors[BF_Binder],P32)),"Select Binder")` → cached `1.1`
- `H36` L/m²: `=IF(OR($N$32="HaTelit",$K$32="Double 2nd Coat",$K$26="N/A",$N$32="HUESKER Chipseal Grid A10",$N$32="HUESKER Chipseal Grid A15"),"",
IF(ISNUMBER(MATCH($K$26,{"Granular","Foamed bitumen","Primed","Primer Seal","Bridge deck"},0)),0,
INDEX(LookupsTbl[E (Value)],
MATCH(1,
(LookupsTbl[KeyA]=UPPER(TRIM($K$26)))*
(LookupsTbl[KeyB]=UPPER(TRIM($K$38)))*
(LookupsTbl[C (Min Sand Patch)]<=N($N$26))*
(LookupsTbl[D (Max Sand Patch)]>=N($N$26)),
0))))` → cached `None`
- `AG36` L/m²: `=IF(OR(X32="HaTelit", U32="Double 2nd Coat"),
    0,
    INDEX([2]Lookups!$E$2:$E$100,
        MATCH(1,
            ([2]Lookups!$A$2:$A$100=U26) *
            ([2]Lookups!$B$2:$B$100=U38) *
            (X26>=[2]Lookups!$C$2:$C$100) *
            (X26<=[2]Lookups!$D$2:$D$100),
        0)
    )
)` → cached `0`
- `BJ39` .HSS1-M: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(#REF!,$BH$38:$BI$38,$BH$39:$BI$60),,TRUE)` → cached `#REF!`
- `BM39` .HSS1-M: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(K20,$BH$38:$BI$38,$BH$39:$BI$60),,TRUE)` → cached `#VALUE!`
- `BN39` .HSS1-M: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(#REF!,$BH$38:$BI$38,$BH$39:$BI$60),,TRUE)` → cached `#REF!`
- `BT39` Filterd List: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(#REF!,$BH$38:$BI$38,$BH$39:$BI$60),,TRUE)` → cached `#REF!`
- `BU39` Filterd List: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(#REF!,$BH$38:$BI$38,$BH$39:$BI$60),,TRUE)` → cached `#REF!`
- `BV39` Filterd List: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(#REF!,$BH$38:$BI$38,$BH$39:$BI$60),,TRUE)` → cached `#REF!`
- `A42` : `=INDEX(LookupsTbl[E (Value)],1)` → cached `Note 1`
- `H42` NOT Profiled asphalt: `=IF(P32="C170",
    IF(N32="HaTelit",
        MROUND(
            MIN(
                IF(N26<0.4,0.55,IF(N26<0.8,0.65,0.8)),
                MAX(
                    IF(N26<0.4,0.45,IF(N26<0.8,0.55,0.55)),
                    IF(N26<0.4,0.5,IF(N26<0.8,0.6,0.75)) +
                    _xlfn.XLOOKUP(G42,{"Low","Medium","High"},{-0.05,0,0.05},0)
                )
            ),
            0.01
        ),
        IF(OR(N32="HUESKER Chipseal Grid A10",N32="HUESKER Chipseal Grid A15"),
           _xlfn.LET(_xlpm.sp,MIN(MAX(N26,0),1.7),
               IF(_xlpm.sp<=0.5,0.5,IF(_xlpm.sp<=1.1,0.6,0.7))
           ),
           IF(N32="HUESKER Chipseal Grid",0.6,"")
        )
    ),
    ""
)` → cached `None`
- `BM67` 130 to 140 g/m2: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(#REF!,$BB$66:$BK$66,$BB$67:$BK$71),,TRUE)` → cached `#REF!`
- `BN67` 130 to 140 g/m2: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(N32,$AY$66:$BK$66,$AY$67:$BK$75),,TRUE)` → cached `#N/A`
- `BT67` Filterd List: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(#REF!,$BB$66:$BK$66,$BB$67:$BK$71),,TRUE)` → cached `#REF!`
- `BU67` Filterd List: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(#REF!,$BB$66:$BJ$66,$BB$67:$BJ$71),,TRUE)` → cached `#REF!`
- `BV67` Filterd List: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(#REF!,$BB$66:$BJ$66,$BB$67:$BJ$71),,TRUE)` → cached `#REF!`
- `CD67` Filterd List: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(#REF!,$BB$66:$BJ$66,$BB$67:$BJ$71),,TRUE)` → cached `#REF!`
- `BT100` Filtered List 1: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(BT95,$BE$99,$BE$100:$BE$106),,TRUE)` → cached `AMC 00`
- `BT110` Filterd List 2: `=_xlfn.UNIQUE(_xlfn.XLOOKUP(BV106,$BE$110:$BM$110,$BE$111:$BM$111),,TRUE)` → cached `AMC 0`
- `AY135` BinderType List : `=_xlfn.UNIQUE(_xlfn.XLOOKUP(N32,$AY$121:$CD$121,$AY$122:$CD$130),,TRUE)` → cached `S10E`

## Warning
Some formulas use modern Excel functions like `_xlfn.XLOOKUP`, `_xlfn.UNIQUE`, and `_xlfn.LET`. A phone app must rebuild these explicitly; do not rely on a browser pretending to calculate Excel formulas.
