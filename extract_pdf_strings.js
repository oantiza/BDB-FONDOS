const fs = require('fs');
const readline = require('readline');

// As a fallback since we can't easily install pdf-parse globally here without risking the environment, 
// let's just do a naive strings extraction to catch at least the structure/topics.
const buffer = fs.readFileSync('C:/Users/oanti/Documents/BDB-FONDOS/Informe Estratégico Global Febrero 2026.pdf');
const matches = buffer.toString('ascii').replace(/[^a-zA-ZÀ-ÿ0-9\s.,;-]/g, ' ').replace(/\s+/g, ' ').match(/.{1,150}/g);

fs.writeFileSync('C:/Users/oanti/Documents/BDB-FONDOS/pdf_strings.txt', matches ? matches.join('\n') : '');
console.log('Done extracting raw text approximations.');
