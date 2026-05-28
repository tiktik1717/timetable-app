export default function ConstraintGroupDialog({
    group,
    onSave,
    onCancel,
}) {
    const isEdit = Boolean(group?.id);

    const defaultGroup = group || {
        id: "",
        name: "",
        color: "#ffd54f",
        rules: [],
    };

    function handleSubmit(event) {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);

        const name = formData.get("name").trim();
        const color = formData.get("color");
        const rules = formData.getAll("rules");

        if (!name) {
            alert("יש להזין שם קבוצה");
            return;
        }

        if (rules.length === 0) {
            alert("יש לבחור לפחות חוק אחד");
            return;
        }

        onSave({
            ...defaultGroup,
            id: defaultGroup.id || `group-${Date.now()}`,
            name,
            color,
            rules,
        });
    }

    return (
        <div className="modal-backdrop" onClick={onCancel}>
            <form className="group-dialog" onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()}>
                <h3>{isEdit ? "עריכת קבוצת שיבוץ" : "קבוצת שיבוץ חדשה"}</h3>

                <label className="dialog-field">
                    שם קבוצה:
                    <input name="name" defaultValue={defaultGroup.name} />
                </label>

                <label className="dialog-field">
                    צבע:
                    <input name="color" type="color" defaultValue={defaultGroup.color} />
                </label>

                <div className="dialog-field">
                    חוקים:
                    <label>
                        <input
                            type="checkbox"
                            name="rules"
                            value="sameTime"
                            defaultChecked={defaultGroup.rules?.includes("sameTime")}
                        />
                        חייב באותו טור
                    </label>

                    <label>
                        <input
                            type="checkbox"
                            name="rules"
                            value="notSameTime"
                            defaultChecked={defaultGroup.rules?.includes("notSameTime")}
                        />
                        אסור באותו טור
                    </label>

                    <label>
                        <input
                            type="checkbox"
                            name="rules"
                            value="notSameDaySameClass"
                            defaultChecked={defaultGroup.rules?.includes("notSameDaySameClass")}
                        />
                        אסור באותה שורה
                    </label>
                </div>

                <div className="dialog-actions">
                    <button type="submit" className="action-button">
                        שמור
                    </button>

                    <button type="button" className="dialog-cancel" onClick={onCancel}>
                        ביטול
                    </button>
                </div>
            </form>
        </div>
    );
}