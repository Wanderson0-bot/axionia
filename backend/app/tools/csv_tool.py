from app.tools.spreadsheet_tool import read_spreadsheet

def read_csv(path: str) -> dict:
    return read_spreadsheet(path)
