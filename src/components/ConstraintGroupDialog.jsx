import { useState } from "react";
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

    const [selectedRules, setSelectedRules] = useState(
        defaultGroup.rules || []
    );

    function toggleRule(rule) {
        if (selectedRules.includes(rule)) {
            setSelectedRules(
                selectedRules.filter((r) => r !== rule)
            );
            return;
        }

        let nextRules = [...selectedRules];

        if (rule === "sameTime") {
            nextRules = nextRules.filter(
                (r) => r !== "notSameTime"
            );
        }

        if (rule === "notSameTime") {
            nextRules = nextRules.filter(
                (r) => r !== "sameTime"
            );
        }

        nextRules.push(rule);

        setSelectedRules(nextRules);
    }

    function handleSubmit(event) {
        event.preventDefault();

        const formData = new FormData(event.currentTarget);

        const name = formData.get("name").trim();
        const color = formData.get("color");
        const rules = selectedRules;

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
                            checked={selectedRules.includes("sameTime")}
                            onChange={() => toggleRule("sameTime")}
                        />
                        חייב באותו טור
                    </label>

                    <label>
                        <input
                            type="checkbox"
                            checked={selectedRules.includes("notSameTime")}
                            onChange={() => toggleRule("notSameTime")}
                        />
                        אסור באותו טור
                    </label>

                    <label>
                        <input
                            type="checkbox"
                            checked={selectedRules.includes("notSameDaySameClass")}
                            onChange={() => toggleRule("notSameDaySameClass")}
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