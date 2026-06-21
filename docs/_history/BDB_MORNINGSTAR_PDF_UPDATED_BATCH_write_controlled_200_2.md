# BDB Morningstar PDF Updated Batch Write Controlled 200-2

**Fecha**: 2026-05-20T17:10:28.450Z
**Task ID**: BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-200-2

> [!IMPORTANT]
> Escritura controlada de **200 fondos** (posiciones 126-325) en Firestore `funds_v3`.
> Metodo: `update()` â€” NUNCA `set()`.

---

## 1. Progreso Acumulado

| Batch | Fondos | Estado |
|:---|---:|:---|
| Batch 0 (25-0) | 25 | COMPLETADO â€” 25 OK |
| **Batch 1 (200-2)** | **200** | **ESTE BATCH** |
| Restantes | 195 | Pendiente |
| Missing (excluidos) | 2 | LU0171281750, LU0171282212 |
| **Total escrito** | **325** | |

---

## 2. Exclusiones

| Exclusion | Cantidad | Aplicada |
|:---|---:|:---|
| Missing ISINs | 2 | SI â€” excluidos |
| REVIEW ISINs | 95 | SI â€” excluidos |
| ERROR ISINs | 32 | SI â€” excluidos |
| Batch 0 (ya escritos) | 25 | SI â€” offset 125 |

---

## 3. Resultado de Escritura

| Metrica | Valor |
|:---|:---|
| Writes ejecutados | **200/200** |
| Errores de escritura | **0** |
| Fondos creados | **0** |

---

## 4. Verificacion Post-Write

| Metrica | Valor |
|:---|:---|
| Docs re-leidos | **200** |
| OK | **200** |
| Warnings | **0** |
| Critical Failures | **0** |

---

## 5. Campos Preservados

| Campo | Estado |
|:---|:---|
| `manual` | **INTACTO â€” CONFIRMADO** |
| `manual.costs` | **INTACTO â€” CONFIRMADO** |
| `manual.costs.retrocession` | **INTACTO â€” CONFIRMADO** |

---

## 6. Tabla del Batch

| # | ISIN | Nombre | Clase | Write | Verify |
|:---|:---|:---|:---|:---|:---|
| 126 | `IE00BD5CTX77` | BNY Mellon Global Short-Dated High Yield Bond Fund EUR H Acc Hedged | RF | OK | OK |
| 127 | `IE00BDH6RQ67` | UTI India Dynamic Equity EURO Retail | RV | OK | OK |
| 128 | `IE00BDTYYP61` | Man Funds VI plc - Man High Yield Opportunities D EUR | RF | OK | OK |
| 129 | `IE00BDZRWZ54` | Neuberger Berman Short Duration Emerging Market Debt Fund EUR A Accumulating Class | RF | OK | OK |
| 130 | `IE00BF0GL212` | Polar Capital Funds PLC - Artificial Intelligence Fund R USD Acc (EUR) | RV | OK | OK |
| 131 | `IE00BF2FJG67` | PIMCO GIS Low Duration Opportunities Fund E Class EUR (Hedged) Accumulation | RF | OK | OK |
| 132 | `IE00BJ7B9456` | PIMCO GIS Global Low Duration Real Return Fund E Class EUR (Hedged) Accumulation | Monetario | OK | OK |
| 133 | `IE00BKSBDB61` | Polar Capital Funds PLC - Polar Capital Healthcare Opportunities R Acc (EUR) | RV | OK | OK |
| 134 | `IE00BM95B621` | Polar Capital Funds PLC - Polar Capital Global Technology Fund R Acc | RV | OK | OK |
| 135 | `IE00BMD7ZB71` | Neuberger Berman Next Generation Connectivity Fund EUR A Accumulating Class - Unhedged | RV | OK | OK |
| 136 | `IE00BNG2T811` | Neuberger Berman Short Duration Euro Bond Fund EUR A Accumulating Class | RF | OK | OK |
| 137 | `IE00BYR8H148` | Jupiter Merian World Equity Fund L EUR Acc | RV | OK | OK |
| 138 | `IE00BYVJR916` | Jupiter Gold & Silver Fund L EUR Acc | RV | OK | OK |
| 139 | `IE00BYX5NX33` | Fidelity MSCI World Index Fund EUR P Acc | RV | OK | OK |
| 140 | `IE00BYX5P602` | Fidelity MSCI World Index Fund EUR P Acc (Hedged) | RV | OK | OK |
| 141 | `IE00BZ18VT34` | BNY Mellon Global Infrastructure Income Fund EUR A Inc | RV | OK | OK |
| 142 | `IE00BZ4D7648` | Polar Capital Funds PLC - Polar Capital Global Technology Fund R EUR Hedged Accumulation | RV | OK | OK |
| 143 | `LU0011889846` | Janus Henderson Horizon Euroland Fund A2 EUR | RV | OK | OK |
| 144 | `LU0028119013` | Invesco Funds - Invesco Pan European Small Cap Equity Fund A Accumulation EUR | RV | OK | OK |
| 145 | `LU0034353002` | DWS Floating Rate Notes LC | RF | OK | OK |
| 146 | `LU0072462186` | BlackRock Global Funds - European Value Fund A2 | RV | OK | OK |
| 147 | `LU0073229253` | Morgan Stanley Investment Funds - Asia Equity Fund A | RV | OK | OK |
| 148 | `LU0073235904` | Morgan Stanley Investment Funds - Short Maturity Euro Bond Fund A | RF | OK | OK |
| 149 | `LU0077500055` | Candriam Bonds Euro Corporate 2036 Class C EUR Cap | RF | OK | OK |
| 150 | `LU0080237943` | DWS Euro Ultra Short Fixed Income Fund NC | RF | OK | OK |
| 151 | `LU0084617165` | Robeco Asia-Pacific Equities D € | RV | OK | OK |
| 152 | `LU0086177085` | UBS (Lux) Bond Fund - Euro High Yield (EUR) P-acc | RF | OK | OK |
| 153 | `LU0090845842` | BlackRock Global Funds - World Mining Fund E2 | RV | OK | OK |
| 154 | `LU0093583077` | Candriam Money Market Euro C Acc EUR | Monetario | OK | OK |
| 155 | `LU0094557526` | MFS Meridian Funds - European Research Fund A1 EUR | RV | OK | OK |
| 156 | `LU0102219945` | Goldman Sachs Europe CORE Equity Portfolio Base Inc EUR | RV | OK | OK |
| 157 | `LU0102737730` | Invesco Funds - Invesco Euro Ultra-Short Term Debt Fund A Accumulation EUR | RF | OK | OK |
| 158 | `LU0102737904` | Invesco Funds - Invesco Euro Ultra-Short Term Debt Fund C Accumulation EUR | RF | OK | OK |
| 159 | `LU0112467450` | Nordea 1 - Global Stable Equity Fund BP EUR | RV | OK | OK |
| 160 | `LU0113257694` | Schroder International Selection Fund EURO Corporate Bond A Accumulation EUR | RF | OK | OK |
| 161 | `LU0114722738` | Fidelity Funds - Global Financial Services Fund E-Acc-EUR | RV | OK | OK |
| 162 | `LU0114723033` | Fidelity Funds - Global Industrials Fund E-Acc-EUR | RV | OK | OK |
| 163 | `LU0115139569` | Invesco Funds - Invesco Global Consumer Trends Fund E Accumulation EUR | RV | OK | OK |
| 164 | `LU0115141201` | Invesco Funds - Invesco Pan European Equity Fund E Accumulation EUR | RV | OK | OK |
| 165 | `LU0115143082` | Invesco Funds - Invesco Asia Opportunities Equity Fund E Accumulation EUR | RV | OK | OK |
| 166 | `LU0115759606` | Fidelity Funds - America Fund E-Acc-EUR | RV | OK | OK |
| 167 | `LU0115765678` | Fidelity Funds - Iberia Fund E-Acc-EUR | RV | OK | OK |
| 168 | `LU0115769746` | Fidelity Funds - World Fund E-Acc-EUR | RV | OK | OK |
| 169 | `LU0115773425` | Fidelity Funds - Global Technology Fund E-Acc-EUR | RV | OK | OK |
| 170 | `LU0117843481` | JPMorgan Funds - Taiwan Fund A (dist) USD | RV | OK | OK |
| 171 | `LU0117843721` | JPMorgan Funds - Taiwan Fund D (acc) USD | RV | OK | OK |
| 172 | `LU0117858596` | JPMorgan Funds - Europe Equity Fund D (acc) EUR | RV | OK | OK |
| 173 | `LU0117858679` | JPMorgan Funds - Europe Strategic Growth Fund D (acc) EUR | RV | OK | OK |
| 174 | `LU0117858752` | JPMorgan Funds - Europe Strategic Value Fund D (acc) EUR | RV | OK | OK |
| 175 | `LU0117859560` | JPMorgan Funds - Europe Small Cap Fund D (acc) EUR | RV | OK | OK |
| 176 | `LU0117884675` | JPMorgan Funds - Europe Dynamic Technologies Fund D (acc) EUR | RV | OK | OK |
| 177 | `LU0119063039` | JPMorgan Funds - Europe Dynamic Fund D (acc) EUR | RV | OK | OK |
| 178 | `LU0119620416` | Morgan Stanley Investment Funds - Global Brands Fund A | RV | OK | OK |
| 179 | `LU0119750205` | Invesco Funds - Invesco Sustainable Pan European Systematic Equity Fund A Acc | RV | OK | OK |
| 180 | `LU0119753308` | Invesco Funds - Invesco Sustainable Pan European Systematic Equity Fund E Acc | RV | OK | OK |
| 181 | `LU0121204431` | Goldman Sachs Global Sustainable Equity - X Cap EUR | RV | OK | OK |
| 182 | `LU0125951151` | MFS Meridian Funds - European Value Fund A1 EUR | RV | OK | OK |
| 183 | `LU0127786431` | Goldman Sachs Eurozone Equity Income - P Cap EUR | RV | OK | OK |
| 184 | `LU0128521001` | Templeton European Insights Fund Class N (acc) EUR | RV | OK | OK |
| 185 | `LU0132601682` | Morgan Stanley Investment Funds - Euro Corporate Bond Fund A | RF | OK | OK |
| 186 | `LU0133264522` | Goldman Sachs Global Equity Income Portfolio E Acc EUR | RV | OK | OK |
| 187 | `LU0133267202` | Goldman Sachs Emerging Markets Equity Portfolio E Acc EUR | RV | OK | OK |
| 188 | `LU0133717503` | Schroder International Selection Fund EURO Corporate Bond A1 Accumulation EUR | RF | OK | OK |
| 189 | `LU0137009238` | Vontobel Fund - TwentyFour Euro Short Term Bond C EUR Cap | RF | OK | OK |
| 190 | `LU0144751095` | Candriam Bonds Euro High Yield Class N EUR Cap | RF | OK | OK |
| 191 | `LU0145656715` | DWS Invest ESG Euro Bonds (Short) NC | RF | OK | OK |
| 192 | `LU0151324935` | Candriam Bonds Credit Opportunities Class N EUR Cap | RF | OK | OK |
| 193 | `LU0153585137` | Vontobel Fund - European Equity B EUR Cap | RV | OK | OK |
| 194 | `LU0153925689` | UBS (Lux) Key Selection SICAV - European Equity Value Opportunity (EUR) P-acc | RV | OK | OK |
| 195 | `LU0157179127` | JPMorgan Investment Funds - Global Select Equity Fund D (acc) EUR | RV | OK | OK |
| 196 | `LU0161304786` | Schroder International Selection Fund European Value A1 Accumulation EUR | RV | OK | OK |
| 197 | `LU0161305163` | Schroder International Selection Fund European Value A Accumulation EUR | RV | OK | OK |
| 198 | `LU0161305593` | Schroder International Selection Fund European Value B Accumulation EUR | RV | OK | OK |
| 199 | `LU0162660350` | BlackRock Global Funds - Euro Corporate Bond Fund A1 | RF | OK | OK |
| 200 | `LU0165074666` | HSBC Global Investment Funds - Euroland Value AC | RV | OK | OK |
| 201 | `LU0165081950` | HSBC Global Investment Funds - Euroland Value EC | RV | OK | OK |
| 202 | `LU0165520114` | Candriam Bonds Global Inflation Short Duration Class C EUR Cap | Monetario | OK | OK |
| 203 | `LU0169250635` | Generali Investments SICAV - Euro Bond Fund EX | RF | OK | OK |
| 204 | `LU0170293632` | Candriam Bonds Global High Yield Class N EUR Cap | RF | OK | OK |
| 205 | `LU0170473374` | Franklin European Total Return Fund A(acc)EUR | RF | OK | OK |
| 206 | `LU0171275786` | BlackRock Global Funds - Emerging Markets Fund A2 (EUR) | RV | OK | OK |
| 207 | `LU0171285587` | BlackRock Global Funds - Global Long-Horizon Equity Fund E2 (EUR) | RV | OK | OK |
| 208 | `LU0171289902` | BlackRock Global Funds - Sustainable Energy Fund A2 (EUR) | RV | OK | OK |
| 209 | `LU0171290074` | BlackRock Global Funds - Sustainable Energy Fund E2 (EUR) | RV | OK | OK |
| 210 | `LU0171296949` | BlackRock Global Funds - US Flexible Equity Fund E2 (EUR) | RV | OK | OK |
| 211 | `LU0171304552` | BlackRock Global Funds - World Energy Fund E2 (EUR) | RV | OK | OK |
| 212 | `LU0171304719` | BlackRock Global Funds - World Financials Fund A2 (EUR) | RV | OK | OK |
| 213 | `LU0171305443` | BlackRock Global Funds - World Financials Fund E2 (EUR) | RV | OK | OK |
| 214 | `LU0171306680` | BlackRock Global Funds - World Gold Fund E2 (EUR) | RV | OK | OK |
| 215 | `LU0171307068` | BlackRock Global Funds - World Healthscience Fund A2 (EUR) | RV | OK | OK |
| 216 | `LU0171309270` | BlackRock Global Funds - World Healthscience Fund E2 (EUR) | RV | OK | OK |
| 217 | `LU0172157280` | BlackRock Global Funds - World Mining Fund A2 (EUR) | RV | OK | OK |
| 218 | `LU0172157363` | BlackRock Global Funds - World Mining Fund E2 (EUR) | RV | OK | OK |
| 219 | `LU0173779223` | Nordea 1 - Danish Covered Bond Fund BP EUR | RF | OK | OK |
| 220 | `LU0173782102` | Nordea 1 - Asia ex Japan Equity Fund BP EUR | RV | OK | OK |
| 221 | `LU0177497491` | abrdn SICAV II-Euro Corporate Bond Fund A Acc EUR | RF | OK | OK |
| 222 | `LU0181496216` | Schroder International Selection Fund Emerging Asia A1 Accumulation USD | RV | OK | OK |
| 223 | `LU0184627536` | AXA World Funds - Switzerland Equity A Capitalisation EUR | RV | OK | OK |
| 224 | `LU0187079347` | Robeco Global Consumer Trends D EUR | RV | OK | OK |
| 225 | `LU0188151921` | Templeton Emerging Markets Fund N(acc)EUR | RV | OK | OK |
| 226 | `LU0200684180` | BlackRock Global Funds - Emerging Markets Bond Fund E2 (EUR) | RF | OK | OK |
| 227 | `LU0201075453` | Janus Henderson Pan European Fund A2 EUR | RV | OK | OK |
| 228 | `LU0202403266` | Fidelity Active Strategy - FAST - Europe Fund A-ACC-EUR | RV | OK | OK |
| 229 | `LU0203975437` | Robeco BP Global Premium Equities D EUR | RV | OK | OK |
| 230 | `LU0208853944` | JPMorgan Funds - Global Natural Resources Fund D (acc) EUR | RV | OK | OK |
| 231 | `LU0210531983` | JPMorgan Funds - Europe Strategic Value Fund A (acc) EUR | RV | OK | OK |
| 232 | `LU0210536198` | JPMorgan Funds - US Growth Fund A (acc) - USD | RV | OK | OK |
| 233 | `LU0212178916` | BNP Paribas Funds Europe Small Cap Classic Capitalisation | RV | OK | OK |
| 234 | `LU0217139020` | Pictet-Premium Brands P EUR | RV | OK | OK |
| 235 | `LU0217576833` | JPMorgan Funds - Emerging Markets Equity Fund D (acc) EUR | RV | OK | OK |
| 236 | `LU0224105477` | BlackRock Global Funds - Continental European Flexible Fund Class A2 | RV | OK | OK |
| 237 | `LU0224105980` | BlackRock Global Funds - Continental European Flexible Fund E2 | RV | OK | OK |
| 238 | `LU0227385266` | Nordea 1 - Stable Return Fund E EUR | Mixto | OK | OK |
| 239 | `LU0229084990` | BlackRock Global Funds - European Equity Transition Fund A2 | RV | OK | OK |
| 240 | `LU0231205856` | Franklin India Fund N(acc)EUR | RV | OK | OK |
| 241 | `LU0231490524` | abrdn SICAV I - Indian Equity Fund A Acc USD | RV | OK | OK |
| 242 | `LU0232524495` | AB SICAV I - American Growth Portfolio A EUR Acc | RV | OK | OK |
| 243 | `LU0235308482` | Alken Fund - European Opportunities Class R | RV | OK | OK |
| 244 | `LU0236738190` | Schroder International Selection Fund Japanese Equity B Accumulation EUR Hedged | RV | OK | OK |
| 245 | `LU0243958393` | Invesco Funds - Invesco Euro Corporate Bond Fund E Accumulation EUR | RF | OK | OK |
| 246 | `LU0248167537` | Schroder International Selection Fund Global Equity Alpha A1 Accumulation EUR | RV | OK | OK |
| 247 | `LU0248168261` | Schroder International Selection Fund Global Equity Alpha B Accumulation EUR | RV | OK | OK |
| 248 | `LU0248168428` | Schroder International Selection Fund Global Equity Alpha A Accumulation EUR | RV | OK | OK |
| 249 | `LU0248172537` | Schroder International Selection Fund Emerging Asia A Accumulation EUR | RV | OK | OK |
| 250 | `LU0248173006` | Schroder International Selection Fund Emerging Asia B Accumulation EUR | RV | OK | OK |
| 251 | `LU0248174152` | Schroder International Selection Fund Emerging Asia A1 Accumulation EUR | RV | OK | OK |
| 252 | `LU0248181363` | Schroder International Selection Fund Latin American A Accumulation EUR | RV | OK | OK |
| 253 | `LU0248183815` | Schroder International Selection Fund Latin American B Accumulation EUR | RV | OK | OK |
| 254 | `LU0248183906` | Schroder International Selection Fund Asian Opportunities B Accumulation EUR | RV | OK | OK |
| 255 | `LU0248184383` | Schroder International Selection Fund Latin American A1 Accumulation EUR | RV | OK | OK |
| 256 | `LU0248184466` | Schroder International Selection Fund Asian Opportunities A Accumulation EUR | RV | OK | OK |
| 257 | `LU0251119078` | Fidelity Funds - Fidelity Target™ 2035 Fund A-Acc-EUR | RV | OK | OK |
| 258 | `LU0251660279` | AXA World Funds - Euro Strategic Bonds E Capitalisation EUR | RF | OK | OK |
| 259 | `LU0251661590` | AXA World Funds - Euro Long Duration Bonds E Capitalisation EUR | RF | OK | OK |
| 260 | `LU0251807987` | BNP Paribas Funds Japan Small Cap Classic EUR Capitalisation | RV | OK | OK |
| 261 | `LU0251853072` | AB SICAV I - International Health Care Portfolio Class A EUR Acc | RV | OK | OK |
| 262 | `LU0252500524` | JPMorgan Funds - EUR Money Market VNAV Fund D (acc) EUR | Monetario | OK | OK |
| 263 | `LU0252970834` | BlackRock Global Funds - European Equity Transition Fund A2 (USD) | RV | OK | OK |
| 264 | `LU0254836850` | Robeco Capital Growth Funds - Robeco Emerging Stars Equities D EUR | RV | OK | OK |
| 265 | `LU0256839860` | Allianz Global Investors Fund - Allianz Europe Equity Growth CT EUR | RV | OK | OK |
| 266 | `LU0260085492` | Jupiter European Select Class L EUR Acc | RV | OK | OK |
| 267 | `LU0260869739` | Franklin U.S. Opportunities Fund A(acc)EUR | RV | OK | OK |
| 268 | `LU0261948227` | Fidelity Funds - Germany Fund A-Acc-EUR | RV | OK | OK |
| 269 | `LU0261951957` | FF - Global Dividend Plus Fund A-Acc-EUR | RV | OK | OK |
| 270 | `LU0261952682` | Fidelity Funds - Euro 50 Index Fund A-Acc-EUR | RV | OK | OK |
| 271 | `LU0267388220` | Fidelity Funds - Euro Short Term Bond Fund A-Acc-EUR | RF | OK | OK |
| 272 | `LU0267984697` | Invesco Funds - Invesco India Equity Fund E Accumulation EUR | RV | OK | OK |
| 273 | `LU0270905242` | Pictet-Security R EUR | RV | OK | OK |
| 274 | `LU0273148055` | DWS Invest Gold and Precious Metals Equities NC | RV | OK | OK |
| 275 | `LU0273159177` | DWS Invest Gold and Precious Metals Equities LC | RV | OK | OK |
| 276 | `LU0273690064` | Goldman Sachs Asia Equity Growth & Income - P Cap EUR | RV | OK | OK |
| 277 | `LU0275692696` | Fidelity Funds - US Equity Fund A-Acc-EUR | RV | OK | OK |
| 278 | `LU0279459456` | Schroder International Selection Fund Global Emerging Market Opportunities A Accumulation EUR | RV | OK | OK |
| 279 | `LU0279460892` | Schroder International Selection Fund Global Smaller Companies A1 Accumulation | RV | OK | OK |
| 280 | `LU0280435388` | Pictet - Clean Energy Transition P EUR | RV | OK | OK |
| 281 | `LU0280435461` | Pictet-Clean Energy Transition R EUR | RV | OK | OK |
| 282 | `LU0282719219` | CT (Lux) - Pan European Small Cap Opportunities Class AE (EUR Accumulation Shares) | RV | OK | OK |
| 283 | `LU0289089384` | JPMorgan Funds - Europe Equity Plus Fund A (perf) (acc) EUR | RV | OK | OK |
| 284 | `LU0289214628` | JPMorgan Funds - Europe Equity Plus Fund D (perf) (acc) EUR | RV | OK | OK |
| 285 | `LU0293313325` | Allianz Global Investors Fund - Allianz GEM Equity High Dividend AT EUR | RV | OK | OK |
| 286 | `LU0293313671` | Allianz Global Investors Fund - Allianz GEM Equity High Dividend CT EUR | RV | OK | OK |
| 287 | `LU0294249692` | Carmignac Portfolio Grande Europe E EUR Acc | RV | OK | OK |
| 288 | `LU0300507208` | Generali Investments SICAV - Euro Future Leaders EX | RV | OK | OK |
| 289 | `LU0300741732` | Franklin Natural Resources Fund A(acc)EUR | RV | OK | OK |
| 290 | `LU0302445910` | Schroder International Selection Fund Global Climate Change Equity A Accumulation | RV | OK | OK |
| 291 | `LU0302446645` | Schroder International Selection Fund Global Climate Change Equity A Accumulation | RV | OK | OK |
| 292 | `LU0302446991` | Schroder International Selection Fund Global Climate Change Equity B Accumulation | RV | OK | OK |
| 293 | `LU0309468980` | Nordea 1 - Latin American Equity Fund E EUR | RV | OK | OK |
| 294 | `LU0313923228` | BlackRock Strategic Funds - European Opportunities Extension Fund A2 EUR | RV | OK | OK |
| 295 | `LU0318931192` | Fidelity Funds - China Focus Fund A-Acc-EUR | RV | OK | OK |
| 296 | `LU0320896664` | Robeco BP US Premium Equities DH € | RV | OK | OK |
| 297 | `LU0321373184` | Schroder International Selection Fund European Dividend Maximiser B Distribution | RV | OK | OK |
| 298 | `LU0323041763` | Chahine Funds - Equity Europe R | RV | OK | OK |
| 299 | `LU0326425351` | BlackRock Global Funds - World Mining Fund E2 EUR Hedged | RV | OK | OK |
| 300 | `LU0329070915` | Jupiter India Select Class L EUR Acc | RV | OK | OK |
| 301 | `LU0329203656` | JPMorgan Investment Funds - Global Dividend Fund D (acc) EUR (hedged) | RV | OK | OK |
| 302 | `LU0329206832` | JPMorgan Investment Funds - Japan Strategic Value Fund D (acc) EUR | RV | OK | OK |
| 303 | `LU0329355670` | Robeco QI Emerging Markets Active Equities D € | RV | OK | OK |
| 304 | `LU0329430986` | GAM Multistock - Luxury Brands Equity EUR E | RV | OK | OK |
| 305 | `LU0329678410` | Fidelity Funds - Emerging Asia Fund A-Acc-EUR | RV | OK | OK |
| 306 | `LU0331286574` | BlackRock Global Funds - Sustainable Energy Fund C2 (EUR) | RV | OK | OK |
| 307 | `LU0333810850` | Goldman Sachs India Equity Portfolio E Acc EUR | RV | OK | OK |
| 308 | `LU0340559557` | Pictet-Timber P EUR | RV | OK | OK |
| 309 | `LU0345361124` | Fidelity Funds - Asia Pacific Opportunities Fund A-Acc-EUR | RV | OK | OK |
| 310 | `LU0348529792` | Fidelity Active Strategy - FAST - Europe Fund E-ACC-EUR | RV | OK | OK |
| 311 | `LU0348784041` | Allianz Global Investors Fund - Allianz Oriental Income AT EUR | RV | OK | OK |
| 312 | `LU0348926287` | Nordea 1 - Global Climate and Environment Fund BP EUR | RV | OK | OK |
| 313 | `LU0348927251` | Nordea 1 - Global Climate and Environment Fund E EUR | RV | OK | OK |
| 314 | `LU0353647737` | Fidelity Funds - European Dividend Fund A-Acc-EUR | RV | OK | OK |
| 315 | `LU0353649352` | Fidelity Funds - Global Inflation-linked Bond Fund E-Acc-EUR (hedged) | Monetario | OK | OK |
| 316 | `LU0365089902` | Jupiter India Select Class L USD A Inc | RV | OK | OK |
| 317 | `LU0365775922` | Schroder International Selection Fund Greater China A Accumulation EUR | RV | OK | OK |
| 318 | `LU0368678339` | Fidelity Funds - Pacific Fund A-Acc-EUR | RV | OK | OK |
| 319 | `LU0384381660` | Morgan Stanley Investment Funds - QuantActive Global Infrastructure Fund A | RV | OK | OK |
| 320 | `LU0387754996` | Robeco Global Stars Equities D EUR | RV | OK | OK |
| 321 | `LU0391944815` | Pictet-Global Megatrend Selection R EUR | RV | OK | OK |
| 322 | `LU0399356780` | DWS Invest Latin American Equities LC | RV | OK | OK |
| 323 | `LU0413376566` | BlackRock Global Funds - Emerging Markets Bond Fund A2 Hedged | RF | OK | OK |
| 324 | `LU0413543058` | Fidelity Funds - Japan Value Fund A-Acc-EUR | RV | OK | OK |
| 325 | `LU0415391431` | Bellevue Funds (Lux) - Bellevue Medtech & Services B EUR | RV | OK | OK |

---

## 7. Confirmaciones de Seguridad

| Invariante | Estado |
|:---|:---|
| Firestore writes | **200** |
| Fondos creados | **0 â€” CONFIRMADO** |
| Missing ISINs tocados | **0 â€” CONFIRMADO** |
| REVIEW tocados | **0 â€” CONFIRMADO** |
| ERROR tocados | **0 â€” CONFIRMADO** |
| manual.* tocado | **NO â€” CONFIRMADO** |
| manual.costs.retrocession tocado | **NO â€” CONFIRMADO** |
| BDB-FONDOS-CORE tocado | **NO â€” CONFIRMADO** |
| Deploy | **NO â€” CONFIRMADO** |
| Commit | **NO â€” CONFIRMADO** |
| Push | **NO â€” CONFIRMADO** |

---

## 8. Rollback

Archivo: `artifacts/morningstar_pdf_updated_batch/write_controlled_200_2/rollback_batch_200_2.json`
Documentos: **200** (estado pre-write desde snapshot)

---

## 9. Recomendacion

> [!TIP]
> Los 200 writes se ejecutaron correctamente. manual.* intacto en todos los casos.

**Recomendacion**: Proceder con el batch restante de **195 ISINs**.

---

*Batch 1 (100 fondos) â€” Writes: 200 â€” Total acumulado: 325/520*
