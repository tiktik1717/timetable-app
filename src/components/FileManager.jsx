export default function FileManager({
    saveProjectToFile,
    loadProjectFromFile,
    handleExcelUpload,
    clearProject,
}) {
    return (
        <div className="file-manager">
            <h3>קובץ</h3>

            <div className="file-actions">
                <button className="file-action-button" onClick={saveProjectToFile}>
                    שמור פרויקט
                </button>

                <label className="file-action-button">
                    טען פרויקט
                    <input
                        type="file"
                        accept=".json"
                        onChange={loadProjectFromFile}
                        hidden
                    />
                </label>

                <label className="file-action-button">
                    ייבוא Excel
                    <input
                        type="file"
                        accept=".xlsx,.xlsm,.xls"
                        onChange={handleExcelUpload}
                        hidden
                    />
                </label>

                <button className="file-action-button danger-file-button" onClick={clearProject}>
                    נקה מערכת
                </button>
            </div>
        </div>
    );
}