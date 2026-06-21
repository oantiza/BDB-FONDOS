# BDB Morningstar PDF Updated Batch Write Controlled 195-3

**Fecha**: 2026-05-20T17:12:35.681Z
**Task ID**: BDB-MORNINGSTAR-PDF-UPDATED-BATCH-WRITE-CONTROLLED-195-3

> [!IMPORTANT]
> Escritura controlada de **195 fondos** (posiciones 326-520) en Firestore `funds_v3`.
> Metodo: `update()` â€” NUNCA `set()`.

---

## 1. Progreso Acumulado

| Batch | Fondos | Estado |
|:---|---:|:---|
| Batch 0 (25-0) | 25 | COMPLETADO â€” 25 OK |
| **Batch 1 (195-3)** | **195** | **ESTE BATCH** |
| Restantes | 0 | Pendiente |
| Missing (excluidos) | 2 | LU0171281750, LU0171282212 |
| **Total escrito** | **520** | |

---

## 2. Exclusiones

| Exclusion | Cantidad | Aplicada |
|:---|---:|:---|
| Missing ISINs | 2 | SI â€” excluidos |
| REVIEW ISINs | 95 | SI â€” excluidos |
| ERROR ISINs | 32 | SI â€” excluidos |
| Batch 0 (ya escritos) | 25 | SI â€” offset 325 |

---

## 3. Resultado de Escritura

| Metrica | Valor |
|:---|:---|
| Writes ejecutados | **195/195** |
| Errores de escritura | **0** |
| Fondos creados | **0** |

---

## 4. Verificacion Post-Write

| Metrica | Valor |
|:---|:---|
| Docs re-leidos | **195** |
| OK | **195** |
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
| 326 | `LU0425308169` | BlackRock Global Funds - Global Inflation Linked Bond Fund A2 EUR Hedged | Monetario | OK | OK |
| 327 | `LU0430492750` | JPMorgan Funds - Euro Aggregate Bond Fund C (acc) EUR | RF | OK | OK |
| 328 | `LU0438336694` | BlackRock ESG Fixed Income Strategies Fund E2 EUR | RF | OK | OK |
| 329 | `LU0447425785` | SIH FCP - Short Term EUR A Classic | RF | OK | OK |
| 330 | `LU0455556406` | UBS (Lux) Bond SICAV - Global Inflation-linked (USD) (EUR hedged) P-acc | Monetario | OK | OK |
| 331 | `LU0469270010` | AB FCP I - Asia Ex-Japan Equity Portfolio C EUR Acc | RV | OK | OK |
| 332 | `LU0491217419` | Robeco Indian Equities D € | RV | OK | OK |
| 333 | `LU0496368142` | Franklin Gold and Precious Metals Fund A(acc)EUR-H1 | RV | OK | OK |
| 334 | `LU0496369389` | Franklin Gold and Precious Metals Fund N(acc)EUR | RV | OK | OK |
| 335 | `LU0501220429` | Global Evolution Funds - Frontier Markets R EUR H | RF | OK | OK |
| 336 | `LU0503631714` | Pictet - Global Environmental Opportunities P EUR | RV | OK | OK |
| 337 | `LU0522352516` | JPMorgan Funds - India Fund D (acc) EUR | RV | OK | OK |
| 338 | `LU0524465548` | Alken Fund - Small Cap Europe Class A | RV | OK | OK |
| 339 | `LU0524465977` | Alken Fund - European Opportunities Class A | RV | OK | OK |
| 340 | `LU0546917344` | Goldman Sachs Euro Long Duration Bond - P Cap EUR | RF | OK | OK |
| 341 | `LU0552029406` | Amundi Funds - Latin America Equity A EUR (C) | RV | OK | OK |
| 342 | `LU0552029661` | Amundi Funds - Latin America Equity G EUR (C) | RV | OK | OK |
| 343 | `LU0552385295` | Morgan Stanley Investment Funds - Global Opportunity Fund A | RV | OK | OK |
| 344 | `LU0554840230` | Robeco Global Consumer Trends Equities M | RV | OK | OK |
| 345 | `LU0563745743` | Bestinver Tordesillas SICAV Iberia A | RV | OK | OK |
| 346 | `LU0565136552` | First Eagle Amundi International Fund Class FE-C Shares | Mixto | OK | OK |
| 347 | `LU0568583420` | Amundi Funds - Equity Japan Target A EUR (C) | RV | OK | OK |
| 348 | `LU0568620727` | Amundi Funds - Cash EUR G2 EUR (C) | Monetario | OK | OK |
| 349 | `LU0569862609` | UBAM - Global High Yield Solution AHC EUR | RF | OK | OK |
| 350 | `LU0570870567` | CT (Lux) - Global Smaller Companies AE (EUR Accumulation Shares) | RV | OK | OK |
| 351 | `LU0571101558` | Groupama Euro High Yield NC | RF | OK | OK |
| 352 | `LU0594300096` | Fidelity Funds - China Consumer Fund A-Acc-EUR | RV | OK | OK |
| 353 | `LU0594539719` | Candriam Bonds Emerging Markets Class C EUR Hedged Cap | RF | OK | OK |
| 354 | `LU0602539867` | Nordea 1 - Emerging Sustainable Stars Equity Fund BP EUR | RV | OK | OK |
| 355 | `LU0604766674` | Allianz Global Investors Fund - Allianz Global Metals and Mining AT EUR | RV | OK | OK |
| 356 | `LU0607512935` | Invesco Funds - Invesco Developed Small and Mid-Cap Equity Fund E Accumulation | RV | OK | OK |
| 357 | `LU0607513586` | Invesco Funds - Invesco Global Equity Income Fund E Accumulation EUR | RV | OK | OK |
| 358 | `LU0616839501` | DWS Invest Euro High Yield Corporates LC | RF | OK | OK |
| 359 | `LU0616856935` | DWS Invest Brazilian Equities LC | RV | OK | OK |
| 360 | `LU0616857313` | DWS Invest Brazilian Equities NC | RV | OK | OK |
| 361 | `LU0628612748` | BlackRock Global Funds - European Equity Income Fund E2 | RV | OK | OK |
| 362 | `LU0630951415` | Fidelity Funds - Emerging Asia Fund E-Acc-EUR | RV | OK | OK |
| 363 | `LU0631859229` | Bellevue Funds (Lux) - Bellevue Entrepreneur Europe Small B EUR | RV | OK | OK |
| 364 | `LU0637302547` | Nordea 1 - Emerging Market Corporate Bond Fund BP EUR | RF | OK | OK |
| 365 | `LU0637335638` | Nordea 1 - Indian Equity Fund BP EUR | RV | OK | OK |
| 366 | `LU0658026512` | AXA IM Fixed Income Investment Strategies - Europe Short Duration High Yield E | RF | OK | OK |
| 367 | `LU0661986348` | JPMorgan Funds - Euroland Dynamic Fund D (perf) (acc) EUR | RV | OK | OK |
| 368 | `LU0690375182` | Fundsmith Equity Fund T EUR Acc | RV | OK | OK |
| 369 | `LU0702159772` | Fidelity Funds - Asian Smaller Companies Fund A-Acc-EUR | RV | OK | OK |
| 370 | `LU0704154706` | RAM (Lux) Systematic Funds - Emerging Markets Equities O EUR | RV | OK | OK |
| 371 | `LU0706127809` | UBS (Lux) Bond SICAV - Global Short Term Flexible (USD) (EUR hedged) P-acc | RF | OK | OK |
| 372 | `LU0712123511` | Morgan Stanley Investment Funds - Global Fixed Income Opportunities Fund AH (EUR) | RF | OK | OK |
| 373 | `LU0733673288` | Nordea 1 - European Cross Credit Fund BP EUR | RF | OK | OK |
| 374 | `LU0766123821` | Fidelity Funds - China Focus Fund E-Acc-EUR | RV | OK | OK |
| 375 | `LU0769137737` | BlackRock Global Funds - Continental European Flexible Fund Class A2 (USD) | RV | OK | OK |
| 376 | `LU0772958525` | Nordea 1 - North American Sustainable Stars Equity Fund BP USD | RV | OK | OK |
| 377 | `LU0795636256` | Schroder International Selection Fund Emerging Markets Hard Currency A Accumulation EUR Hedged | RF | OK | OK |
| 378 | `LU0813337002` | DWS Invest Latin American Equities NC | RV | OK | OK |
| 379 | `LU0815263628` | Morgan Stanley Investment Funds - Emerging Leaders Equity Fund A | RV | OK | OK |
| 380 | `LU0823411706` | BNP Paribas Funds Consumer InnovatorsClassic Capitalisation | RV | OK | OK |
| 381 | `LU0823421689` | BNP Paribas Funds Disruptive Technology Classic Capitalisation | RV | OK | OK |
| 382 | `LU0826452848` | DWS Invest II Global Equity High Conviction Fund LC | RV | OK | OK |
| 383 | `LU0826453226` | DWS Invest II Global Equity High Conviction Fund NC | RV | OK | OK |
| 384 | `LU0849399786` | Schroder International Selection Fund EURO High Yield A Accumulation | RF | OK | OK |
| 385 | `LU0857700040` | Fidelity Funds - European Dividend Fund A-MINCOME(G)-EUR | RV | OK | OK |
| 386 | `LU0861897477` | Abante Global Funds Spanish Opportunities Class B | RV | OK | OK |
| 387 | `LU0862450516` | JPMorgan Funds - Emerging Markets Dividend Fund D (acc) EUR | RV | OK | OK |
| 388 | `LU0910636546` | Goldman Sachs Emerging Markets Debt Blend Portfolio Other Currency Acc EUR | RF | OK | OK |
| 389 | `LU0910636892` | Goldman Sachs Emerging Markets Debt Blend Portfolio E Acc EUR | RF | OK | OK |
| 390 | `LU0918140210` | T. Rowe Price Funds SICAV - US Smaller Companies Equity Fund A (EUR) | RV | OK | OK |
| 391 | `LU0922333322` | Fidelity Funds - Italy Fund A-Acc-EUR | RV | OK | OK |
| 392 | `LU0926439992` | Vontobel Fund - Emerging Markets Debt H (hedged) EUR Cap | RF | OK | OK |
| 393 | `LU0933684101` | Incometric Equam Global Value A | RV | OK | OK |
| 394 | `LU0935222900` | Natixis AM Funds - Ostrum Euro Inflation R/A (EUR) | RF | OK | OK |
| 395 | `LU0935230242` | Natixis AM Funds - Ostrum Europe MinVol RE/A (EUR) | RV | OK | OK |
| 396 | `LU0940719098` | UBAM - Global High Yield Solution RHC EUR | RF | OK | OK |
| 397 | `LU0986194024` | SIH FCP - Equity Europe A Classic | RV | OK | OK |
| 398 | `LU0995119665` | Schroder International Selection Fund EURO Credit Conviction A Accumulation EUR | RF | OK | OK |
| 399 | `LU0995119749` | Schroder International Selection Fund EURO Credit Conviction B Accumulation EUR | RF | OK | OK |
| 400 | `LU1021288268` | AB FCP I - Mortgage Income Portfolio A2 EUR Acc | RF | OK | OK |
| 401 | `LU1022658667` | Franklin Euro Short Duration Bond Fund A(acc)EUR | RF | OK | OK |
| 402 | `LU1066281574` | SIH FCP - Equity Spain A Classic | RV | OK | OK |
| 403 | `LU1079477284` | Allianz Emerging Markets Short Duration Bond AT (H2-EUR) | RF | OK | OK |
| 404 | `LU1080015693` | Edmond de Rothschild Fund - Emerging Credit A EUR Hedged | RF | OK | OK |
| 405 | `LU1088692675` | UBAM - Global Equity AC EUR | RV | OK | OK |
| 406 | `LU1089088741` | Allianz Global Investors Fund - Allianz Floating Rate Notes Plus VarioZins AT EUR | RF | OK | OK |
| 407 | `LU1103303167` | Edmond de Rothschild Fund - US Value A EUR | RV | OK | OK |
| 408 | `LU1111642820` | Eleva European Selection A2 EUR acc | RV | OK | OK |
| 409 | `LU1120766388` | Candriam Equities L Biotechnology Class C EUR Cap | RV | OK | OK |
| 410 | `LU1161086159` | Amundi Funds - Emerging Markets Blended Bond A EUR (C) | RF | OK | OK |
| 411 | `LU1161526576` | Edmond de Rothschild Fund - Bond Allocation R EUR Acc | RF | OK | OK |
| 412 | `LU1164219682` | AXA World Funds - Euro Credit Total Return A Capitalisation EUR | RF | OK | OK |
| 413 | `LU1164220854` | AXA World Funds - Euro Credit Total Return E Capitalisation EUR | RF | OK | OK |
| 414 | `LU1165644672` | IVO Funds - IVO Emerging Markets Corporate Debt EUR R Acc | RF | OK | OK |
| 415 | `LU1206943596` | Fidelity Active Strategy - FAST - Emerging Markets Fund A-ACC-EUR | RV | OK | OK |
| 416 | `LU1213836080` | Fidelity Funds - Global Technology Fund A-Acc-EUR | RV | OK | OK |
| 417 | `LU1223083087` | Schroder International Selection Fund Global Gold A Accumulation EUR Hedged | RV | OK | OK |
| 418 | `LU1223084051` | Schroder International Selection Fund Global Gold A Accumulation PLN Hedged | RV | OK | OK |
| 419 | `LU1244893696` | Edmond de Rothschild Fund - Big Data A-EUR accumulating | RV | OK | OK |
| 420 | `LU1244895394` | Edmond de Rothschild Fund - Big Data R EUR | RV | OK | OK |
| 421 | `LU1254412460` | abrdn SICAV I - Indian Bond Fund A Acc EUR | RF | OK | OK |
| 422 | `LU1279334483` | Pictet - Robotics R EUR | RV | OK | OK |
| 423 | `LU1295551144` | Capital Group New Perspective Fund (LUX) B (EUR) | RV | OK | OK |
| 424 | `LU1298174530` | CT (Lux) - Global Multi Asset Income Class AE (EUR Accumulation Shares) | Mixto | OK | OK |
| 425 | `LU1299306321` | Carmignac Portfolio Sécurité AW EUR Acc | RF | OK | OK |
| 426 | `LU1299311164` | Carmignac Portfolio Investissement A EUR Acc | RV | OK | OK |
| 427 | `LU1299311834` | Carmignac Portfolio Investissement E EUR Acc | RV | OK | OK |
| 428 | `LU1301026388` | Sycomore Fund SICAV - Sycomore Europe Happy@Work RC EUR | RV | OK | OK |
| 429 | `LU1321847805` | BlackRock Strategic Funds - Emerging Markets Equity Strategies Fund E2 EUR | RV | OK | OK |
| 430 | `LU1330191542` | Magallanes Value Investors UCITS European Equity R EUR | RV | OK | OK |
| 431 | `LU1333148903` | Azvalor Lux SICAV Azvalor International R | RV | OK | OK |
| 432 | `LU1340702932` | MFS Meridian Funds - Global Opportunistic Bond Fund A1 EUR | RF | OK | OK |
| 433 | `LU1353951376` | AXA World Funds - Global Inflation Short Duration Bonds E Capitalisation EUR (Hedged) | Monetario | OK | OK |
| 434 | `LU1362999481` | Robeco High Yield Bonds D € | RF | OK | OK |
| 435 | `LU1372006947` | Cobas LUX SICAV - Cobas Selection Fund Class P Acc EUR | RV | OK | OK |
| 436 | `LU1373035234` | BlackRock Strategic Funds - BSF Systematic Style Factor Fund E2 EUR Hedged | Alternativos | OK | OK |
| 437 | `LU1378878430` | Morgan Stanley Investment Funds - Asia Opportunity Fund A | RV | OK | OK |
| 438 | `LU1383852487` | Allianz Global Investors Fund - Allianz Floating Rate Notes Plus VarioZins AT2 EUR | RF | OK | OK |
| 439 | `LU1391767586` | Fidelity Funds - Global Financial Services Fund A-Acc-EUR | RV | OK | OK |
| 440 | `LU1481179858` | Capital Group New World Fund (LUX) B (EUR) | RV | OK | OK |
| 441 | `LU1481583711` | Flossbach von Storch - Bond Opportunities RT | RF | OK | OK |
| 442 | `LU1486845537` | Oddo BHF Euro Credit Short Duration CR-EUR | RF | OK | OK |
| 443 | `LU1499628912` | Amundi S.F. - Diversified Short-Term Bond Select E EUR ND | RF | OK | OK |
| 444 | `LU1529955046` | Eurizon Fund - Bond Aggregate RMB Class R EUR Acc | RF | OK | OK |
| 445 | `LU1542714578` | Goldman Sachs Europe Sustainable Equity - X Cap EUR | RV | OK | OK |
| 446 | `LU1548496022` | Allianz Global Investors Fund - Allianz Dynamic Multi Asset Strategy SRI 15 AT EUR | Mixto | OK | OK |
| 447 | `LU1548497699` | Allianz Global Investors Fund - Allianz Global Artificial Intelligence AT EUR | RV | OK | OK |
| 448 | `LU1578889864` | Ninety One Global Strategy Fund - Global Gold Fund A Acc EUR Hedged | RV | OK | OK |
| 449 | `LU1582984149` | M&G (Lux) European Inflation Linked Corporate Bond Fund EUR A Acc | RF | OK | OK |
| 450 | `LU1582988306` | M&G (Lux) Dynamic Allocation Fund EUR B Acc | Mixto | OK | OK |
| 451 | `LU1623762843` | Carmignac Pf Credit A EUR Acc | RF | OK | OK |
| 452 | `LU1665237704` | M&G (Lux) Global Listed Infrastructure Fund EUR A Acc | RV | OK | OK |
| 453 | `LU1670618187` | M&G (Lux) Asian Fund EUR A Acc | RV | OK | OK |
| 454 | `LU1670618690` | M&G (Lux) Global Emerging Markets Fund EUR A Acc | RV | OK | OK |
| 455 | `LU1670626446` | M&G (Lux) Japan Fund EUR A Acc | RV | OK | OK |
| 456 | `LU1670631016` | M&G (Lux) Emerging Markets Bond Fund EUR A Acc | RF | OK | OK |
| 457 | `LU1670631289` | M&G (Lux) Emerging Markets Bond Fund EUR A-H Acc | RF | OK | OK |
| 458 | `LU1670707527` | M&G (Lux) European Strategic Value Fund EUR A Acc | RV | OK | OK |
| 459 | `LU1670710075` | M&G (Lux) Global Dividend Fund EUR A Acc | RV | OK | OK |
| 460 | `LU1670715975` | M&G (Lux) Japan Smaller Companies Fund EUR A Acc | RV | OK | OK |
| 461 | `LU1670718219` | M&G (Lux) Short Dated Corporate Bond Fund EUR A Acc | RF | OK | OK |
| 462 | `LU1670722161` | M&G (Lux) Global Floating Rate High Yield Fund EUR A-H Acc | RF | OK | OK |
| 463 | `LU1670724373` | M&G (Lux) Optimal Income Fund EUR A Acc | RF | OK | OK |
| 464 | `LU1679113404` | UBS (Lux) Bond SICAV - Floating Rate Income (USD) (EUR hedged) P-acc | RF | OK | OK |
| 465 | `LU1694212348` | Nordea 1 - Low Duration European Covered Bond Fund BP EUR | RF | OK | OK |
| 466 | `LU1694789451` | DNCA Invest Alpha Bonds A EUR | RF | OK | OK |
| 467 | `LU1697013008` | SIH FCP - Flexible Fixed Income USD | RF | OK | OK |
| 468 | `LU1697016365` | Sigma Investment House FCP - Selection Defensive Class A EUR | Mixto | OK | OK |
| 469 | `LU1706854152` | Amundi S.F. - Diversified Short-Term Bond Select A EUR ND | RF | OK | OK |
| 470 | `LU1717592262` | Groupama Global Inflation Short Duration NC | Monetario | OK | OK |
| 471 | `LU1738492658` | Aviva Investors - Short Duration Global High Yield Bond Fund Ah EUR Acc | RF | OK | OK |
| 472 | `LU1740985814` | DWS Strategic Allocation Dynamic LD | Mixto | OK | OK |
| 473 | `LU1762221155` | Invesco Funds - Invesco Global Founders & Owners Fund E Accumulation EUR | RV | OK | OK |
| 474 | `LU1775950477` | Invesco Funds - Invesco Asian Equity Fund E Accumulation EUR | RV | OK | OK |
| 475 | `LU1819480192` | Echiquier Artificial Intelligence B EUR | RV | OK | OK |
| 476 | `LU1829329819` | CT (Lux) - Pan European Smaller Companies 1E (EUR Accumulation Shares) | RV | OK | OK |
| 477 | `LU1838941372` | Candriam Bonds Floating Rate Notes C EUR Cap | RF | OK | OK |
| 478 | `LU1873127366` | JPMorgan Liquidity Funds - EUR Liquidity LVNAV Fund A (acc) | Monetario | OK | OK |
| 479 | `LU1882457143` | Amundi Funds - Emerging Markets Corporate High Yield Bond A EUR (C) | RF | OK | OK |
| 480 | `LU1882462655` | Amundi Funds - Emerging Markets Short Term Bond A2 EUR (C) | RF | OK | OK |
| 481 | `LU1882462739` | Amundi Funds - Emerging Markets Short Term Bond A2 EUR Hgd (C) | RF | OK | OK |
| 482 | `LU1883318740` | Amundi Funds - Global Equity Responsible A EUR (C) | RV | OK | OK |
| 483 | `LU1883334275` | Amundi Funds - Global Subordinated Bond A EUR (C) | RF | OK | OK |
| 484 | `LU1883342377` | Amundi Funds - Global Equity A EUR (C) | RV | OK | OK |
| 485 | `LU1897556517` | Groupama Global Disruption NC | RV | OK | OK |
| 486 | `LU1902444584` | CPR Invest - Climate Bonds Euro - A EUR - Acc | RF | OK | OK |
| 487 | `LU1915690918` | Nordea 1 - Active Rates Opportunities Fund Fund E EUR | RF | OK | OK |
| 488 | `LU1919971074` | abrdn SICAV I - Frontier Markets Bond Fund A Acc Hedged EUR | RF | OK | OK |
| 489 | `LU1931535931` | Allianz Pet and Animal Wellbeing AT EUR | RV | OK | OK |
| 490 | `LU1939214695` | Nordea 1 - Global Diversity Engagement Fund BP EUR | RV | OK | OK |
| 491 | `LU1951921383` | Allianz Global Investors Fund - Allianz Credit Opportunities AT EUR | RF | OK | OK |
| 492 | `LU1983299162` | Schroder International Selection Fund Global Alternative Energy A Accumulation | RV | OK | OK |
| 493 | `LU2002383896` | Allianz Global Investors Fund - Allianz Credit Opportunities Plus AT EUR | RF | OK | OK |
| 494 | `LU2016064201` | Schroder International Selection Fund Global Alternative Energy A Accumulation EUR Hedged | RV | OK | OK |
| 495 | `LU2050411763` | BlackRock Global Funds - Emerging Markets Equity Income Fund A2 (EUR) | RV | OK | OK |
| 496 | `LU2050860480` | Fidelity Funds - UK Special Situations Fund A-ACC-EUR | RV | OK | OK |
| 497 | `LU2050929277` | Capital Group New Economy Fund (LUX) B (EUR) | RV | OK | OK |
| 498 | `LU2092176515` | BlueBox Funds - BlueBox Global Technology Fund Class C EUR Acc | RV | OK | OK |
| 499 | `LU2094235707` | Goldman Sachs Global Future Technology Leaders Equity Portfolio Class E Shares | RV | OK | OK |
| 500 | `LU2098772366` | Candriam Bonds Credit Alpha C EUR | RF | OK | OK |
| 501 | `LU2131365186` | UBS (Lux) Equity Fund - China Opportunity (USD) P EUR acc | RV | OK | OK |
| 502 | `LU2133220793` | Robeco Sustainable Asian Stars Equities DL EUR | RV | OK | OK |
| 503 | `LU2145461757` | Robeco Smart Energy D-EUR Capitalisation | RV | OK | OK |
| 504 | `LU2145463373` | Robeco Smart Energy M2-EUR Capitalisation | RV | OK | OK |
| 505 | `LU2146190835` | Robeco Sustainable Water D-EUR Capitalisation | RV | OK | OK |
| 506 | `LU2210151341` | Fidelity Funds - Absolute Return Global Equity Fund A-PF-Acc-Euro (Euro/USD hedged) | Alternativos | OK | OK |
| 507 | `LU2222028099` | Merchbanc FCP Renta Fija Flex A | RF | OK | OK |
| 508 | `LU2267099674` | BlackRock Global Funds - China Bond Fund Class A2 USD (EUR) | RF | OK | OK |
| 509 | `LU2278574558` | Buy & Hold Luxembourg B&H Equity Class 2 | RV | OK | OK |
| 510 | `LU2278574988` | Buy & Hold Luxembourg B&H Bond Class 2 | RF | OK | OK |
| 511 | `LU2295319300` | Morgan Stanley Investment Funds - Global Brands Fund A (EUR) | RV | OK | OK |
| 512 | `LU2295320068` | Morgan Stanley Investment Funds - Global Insight Fund A (EUR) | RV | OK | OK |
| 513 | `LU2337806421` | Morgan Stanley Investment Funds - Global Endurance Fund A EUR Acc | RV | OK | OK |
| 514 | `LU2357235493` | Incometric Fund Nartex Equity Fund A Cap EUR Accumulation | RV | OK | OK |
| 515 | `LU2357235576` | Incometric Fund Nartex Equity Fund R Cap EUR Accumulation | RV | OK | OK |
| 516 | `LU2482630162` | M&G European Credit Investment Fund Class P EUR Acc | RF | OK | OK |
| 517 | `LU2504555777` | Fidelity Funds - Global Industrials Fund A-Acc-EUR | RV | OK | OK |
| 518 | `LU2601038578` | Invesco Funds - Invesco Global Founders & Owners Fund A Accumulation EUR | RV | OK | OK |
| 519 | `LU2784406998` | Morgan Stanley Investment Funds - Emerging Markets Debt Opportunities Fund A | RF | OK | OK |
| 520 | `LU3038481936` | Hamco SICAV - Global Value R EUR Acc | RV | OK | OK |

---

## 7. Confirmaciones de Seguridad

| Invariante | Estado |
|:---|:---|
| Firestore writes | **195** |
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

Archivo: `artifacts/morningstar_pdf_updated_batch/write_controlled_195_3/rollback_batch_195_3.json`
Documentos: **195** (estado pre-write desde snapshot)

---

## 9. Recomendacion

> [!TIP]
> Los 195 writes se ejecutaron correctamente. manual.* intacto en todos los casos.

**Recomendacion**: Proceder con el batch restante de **0 ISINs**.

---

*Batch 1 (100 fondos) â€” Writes: 195 â€” Total acumulado: 520/520*
