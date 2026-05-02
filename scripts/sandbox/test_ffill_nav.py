import sys
import os
import json

# Agregamos la ruta del proyecto madre (o al menos `functions_python`) para poder importar
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'functions_python')))

from services.nav_fetcher import merge_history

def test_forward_fill():
    # Historial preexistente con un último dato el Jueves 1. 
    # El Viernes 2, Sábado 3, Domingo 4 no tenemos datos.
    # El lunes 5 no hubo cotización. 
    existing_history = [
        {"date": "2023-11-01", "nav": 100.0}, # Miércoles
    ]
    
    # Nuevos datos descargados (martes 6)
    new_data = [
        {"date": "2023-11-07", "nav": 105.0}, # Martes
    ]
    
    print("Prueba de merge_history (Forward Fill B-Days):")
    print(f"Historial existente: {existing_history}")
    print(f"Datos nuevos: {new_data}")
    
    result = merge_history(existing_history, new_data)
    
    print("\nHistorial resultante:")
    if result:
        for r in result:
            print(f"  {r['date']} -> {r['nav']}")
    else:
        print("  Ningún cambio (None).")
        
    # Verificar que el resultado sea el esperado
    assert result is not None, "El resultado no debería ser None"
    
    dates = [r["date"] for r in result]
    navs = [r["nav"] for r in result]
    
    # Deberíamos tener Jueves(02), Viernes(03), Lunes(06), Martes(07) - Sábado/Domingo no
    assert "2023-11-01" in dates and navs[dates.index("2023-11-01")] == 100.0, "Falta 1/11"
    assert "2023-11-02" in dates and navs[dates.index("2023-11-02")] == 100.0, "Falta 2/11 ffill"
    assert "2023-11-03" in dates and navs[dates.index("2023-11-03")] == 100.0, "Falta 3/11 ffill"
    assert "2023-11-04" not in dates, "Sabado incluido incorrectamente"
    assert "2023-11-05" not in dates, "Domingo incluido incorrectamente"
    assert "2023-11-06" in dates and navs[dates.index("2023-11-06")] == 100.0, "Falta 6/11 ffill"
    assert "2023-11-07" in dates and navs[dates.index("2023-11-07")] == 105.0, "Falta 7/11 update"
    
    print("\n✅ El Forward Fill funciona correctamente!")
    
if __name__ == "__main__":
    test_forward_fill()
