from pathlib import Path
import pandas as pd

def analyze_dataframe(dataframe: pd.DataFrame) -> dict:
    numeric = dataframe.select_dtypes(include="number")
    numeric_columns = numeric.columns.tolist()
    below_average: dict[str, int] = {}
    statistics: dict[str, dict] = {}
    for column in numeric_columns:
        series = numeric[column].dropna()
        if not series.empty:
            mean = float(series.mean())
            below_average[column] = int((series < mean).sum())
            statistics[column] = {"mean": round(mean, 2), "min": float(series.min()), "max": float(series.max())}
    return {"records": int(len(dataframe)), "columns": dataframe.columns.tolist(), "column_count": int(len(dataframe.columns)), "missing_values": {str(key): int(value) for key, value in dataframe.isna().sum().items() if value > 0}, "numeric_columns": numeric_columns, "statistics": statistics, "below_average": below_average, "preview": dataframe.head(10).fillna("").to_dict(orient="records")}

def read_spreadsheet(path: str) -> dict:
    file_path = Path(path)
    if file_path.suffix.lower() == ".csv":
        dataframe = pd.read_csv(file_path)
        source = "CSV"
    else:
        dataframe = pd.read_excel(file_path, engine="openpyxl")
        source = "XLSX"
    return {"source": source, **analyze_dataframe(dataframe)}
