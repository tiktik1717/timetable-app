export default function FileManager({
  saveProjectToFile,
  loadProjectFromFile,
  handleExcelUpload,
  clearProject,
  checkpoints,
  activeCheckpointId,
  setActiveCheckpointId,
  createCheckpoint,
  deleteCheckpoint,
  restoreCheckpoint,
}) {
  function formatDate(value) {
    if (!value) return "";

    return new Date(value).toLocaleString("he-IL");
  }

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

        <button
          className="file-action-button danger-file-button"
          onClick={clearProject}
        >
          נקה מערכת
        </button>
      </div>

      <hr />

      <div className="checkpoints-section">
        <div className="manager-header">
          <h3>נקודות שמירה</h3>

          <button className="action-button" onClick={createCheckpoint}>
            צור נקודת שמירה
          </button>
        </div>

        {checkpoints.length === 0 ? (
          <p>אין נקודות שמירה עדיין.</p>
        ) : (
          <table className="manager-table checkpoints-table">
            <thead>
              <tr>
                <th>פעילה</th>
                <th>שם</th>
                <th>תאריך</th>
                <th>פעולות</th>
              </tr>
            </thead>

            <tbody>
              {checkpoints.map((checkpoint) => (
                <tr key={checkpoint.id}>
                  <td>
                    <input
                      type="radio"
                      name="activeCheckpoint"
                      checked={activeCheckpointId === checkpoint.id}
                      onChange={() => setActiveCheckpointId(checkpoint.id)}
                    />
                  </td>

                  <td>{checkpoint.name}</td>
                  <td>{formatDate(checkpoint.createdAt)}</td>

                  <td>
                    <button
                      className="mini-button"
                      onClick={() => restoreCheckpoint(checkpoint.id)}
                    >
                      שחזר
                    </button>

                    <button
                      className="mini-button danger-mini-button"
                      onClick={() => deleteCheckpoint(checkpoint.id)}
                    >
                      מחק
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}