const fs = require('fs');

try {
    const data = fs.readFileSync('audit_funds_v3_details.jsonl', 'utf-8');
    const lines = data.split('\n').filter(l => l.trim().length > 0);
    const csvLines = ['isin,name'];
    
    for (const line of lines) {
        const obj = JSON.parse(line);
        // Escape quotes in name using standard CSV rules
        const name = obj.name ? obj.name.replace(/"/g, '""') : 'Unknown';
        csvLines.push(`${obj.isin || ''},"${name}"`);
    }

    fs.writeFileSync('ISIN_Nombres.csv', csvLines.join('\n'), 'utf-8');
    console.log("CSV 'ISIN_Nombres.csv' generated successfully with " + lines.length + " funds.");
} catch (error) {
    console.error("Error generating CSV: ", error);
}
