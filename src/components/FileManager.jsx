import { useState } from "react";
import AuthPanel from "./AuthPanel";

export default function FileManager({
    saveProjectToFile,
    saveSchedulingMetadataToFile,
    loadProjectFromFile,
    handleExcelUpload,
    clearProject,
    checkpoints,
    currentCheckpointId,
    createCheckpoint,
    deleteCheckpoint,
    restoreCheckpoint,
    user,
    setUser,
    cloudProjects,
    selectedCloudProjectId,
    setSelectedCloudProjectId,
    loadCloudProjects,
    saveProjectToCloud,
    updateSelectedCloudProject,
    handleCloudProjectSelection,
    deleteSelectedCloudProject,
    hasUnsavedCloudChanges,
    lastCloudSavedAt,
    setShowHelpDialog,
    copyConstraintGroupsFromCloudProject,
}) {

    const [showCopyGroupsDialog, setShowCopyGroupsDialog] =
        useState(false);

    const [
        sourceProjectIdForGroups,
        setSourceProjectIdForGroups,
    ] = useState("");

    function formatDate(value) {
        if (!value) return "";

        return new Date(value).toLocaleString("he-IL");
    }

    return (
        <div className="file-manager">
            <h3>קובץ</h3>
            <AuthPanel user={user} setUser={setUser} />
            <div className="cloud-section">
                <h3>שמירה בענן</h3>
                <div className="cloud-save-status">
                    {selectedCloudProjectId ? (
                        hasUnsavedCloudChanges ? (
                            <span className="cloud-unsaved">יש שינויים שלא נשמרו בענן</span>
                        ) : (
                            <span className="cloud-saved">
                                שמור בענן{lastCloudSavedAt ? ` — ${lastCloudSavedAt}` : ""}
                            </span>
                        )
                    ) : (
                        <span>לא נבחר פרויקט ענן</span>
                    )}
                </div>
                <div className="cloud-actions">
                    <select
                        value={selectedCloudProjectId}
                        onChange={(e) => handleCloudProjectSelection(e.target.value)}
                        disabled={!user}
                    >
                        <option value="">בחר פרויקט בענן</option>

                        {cloudProjects.map((project) => (
                            <option key={project.id} value={project.id}>
                                {project.name}
                            </option>
                        ))}
                    </select>

                    <button className="file-action-button" onClick={loadCloudProjects} disabled={!user}>
                        רענן רשימה
                    </button>

                    <button className="file-action-button" onClick={saveProjectToCloud} disabled={!user}>
                        שמור כפרויקט חדש בענן
                    </button>

                    <button
                        className="file-action-button"
                        onClick={updateSelectedCloudProject}
                        disabled={!user || !selectedCloudProjectId}
                    >
                        עדכן פרויקט נבחר
                    </button>

                    <button
                        className="file-action-button"
                        onClick={() => {
                            setSourceProjectIdForGroups("");
                            setShowCopyGroupsDialog(true);
                        }}
                        disabled={!user || cloudProjects.length === 0}
                    >
                        העתק קבוצות שיבוץ מפרויקט אחר
                    </button>

                    <button
                        className="file-action-button danger-file-button"
                        onClick={deleteSelectedCloudProject}
                        disabled={!user || !selectedCloudProjectId}
                    >
                        מחק מהענן
                    </button>
                </div>
                {showCopyGroupsDialog && (
                    <div className="modal-overlay">
                        <div className="modal-dialog">
                            <h3>העתקת קבוצות שיבוץ</h3>

                            <p>
                                בחר את הפרויקט שממנו תרצה להעתיק את
                                רשימת קבוצות השיבוץ.
                            </p>

                            <select
                                value={sourceProjectIdForGroups}
                                onChange={(e) =>
                                    setSourceProjectIdForGroups(
                                        e.target.value
                                    )
                                }
                            >
                                <option value="">
                                    בחר פרויקט מקור
                                </option>

                                {cloudProjects
                                    .filter(
                                        (project) =>
                                            project.id !==
                                            selectedCloudProjectId
                                    )
                                    .map((project) => (
                                        <option
                                            key={project.id}
                                            value={project.id}
                                        >
                                            {project.name}
                                        </option>
                                    ))}
                            </select>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="file-action-button"
                                    onClick={async () => {
                                        if (
                                            !sourceProjectIdForGroups
                                        ) {
                                            alert(
                                                "יש לבחור פרויקט מקור."
                                            );
                                            return;
                                        }

                                        const success =
                                            await copyConstraintGroupsFromCloudProject(
                                                sourceProjectIdForGroups
                                            );

                                        if (success) {
                                            setShowCopyGroupsDialog(false);
                                            setSourceProjectIdForGroups(
                                                ""
                                            );
                                        }
                                    }}
                                >
                                    העתק קבוצות
                                </button>

                                <button
                                    type="button"
                                    className="file-action-button"
                                    onClick={() => {
                                        setShowCopyGroupsDialog(false);
                                        setSourceProjectIdForGroups("");
                                    }}
                                >
                                    ביטול
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="file-actions">
                <button className="file-action-button" onClick={saveProjectToFile}>
                    שמור פרוייקט לקובץ
                </button>

                <button
                    className="file-action-button"
                    onClick={saveSchedulingMetadataToFile}
                >
                    ייצא נתונים לניסוי שיבוץ
                </button>

                <label className="file-action-button">
                    טען פרויקט מקובץ
                    <input
                        type="file"
                        accept=".json"
                        onChange={loadProjectFromFile}
                        hidden
                    />
                </label>

                <label className="file-action-button">
                    ייבוא סדין מ-Excel
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
                                <th>נוכחית</th>
                                <th>שם</th>
                                <th>תאריך</th>
                                <th>פעולות</th>
                            </tr>
                        </thead>

                        <tbody>
                            {checkpoints.map((checkpoint) => (
                                <tr key={checkpoint.id}>
                                    <td>
                                        {currentCheckpointId === checkpoint.id ? "✓" : ""}
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
            <div>
                <p>
                    -----------------------------------------------------
                </p>
                <button
                    type="button"
                    className="file-action-button"
                    onClick={() => setShowHelpDialog(true)}
                >
                    עזרה
                </button>
            </div>
        </div>

    );
}