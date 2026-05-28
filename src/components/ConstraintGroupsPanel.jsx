function getRuleLabels(group) {
    const rules = group.rules || (group.type ? [group.type] : []);

    const labels = {
        sameTime: "חייב באותו טור",
        notSameTime: "אסור באותו טור",
        notSameDaySameClass: "אסור באותה שורה",
    };

    return rules.map((rule) => labels[rule] || rule).join(" + ");
}

export default function ConstraintGroupsPanel({ constraintGroups }) {
    return (
        <div className="constraint-panel">
            <h3>קבוצות שיבוץ</h3>

            {constraintGroups.length === 0 ? (
                <div className="empty-constraints">אין קבוצות עדיין</div>
            ) : (
                constraintGroups.map((group) => (
                    <div key={group.id} className="constraint-item">
                        <span
                            className="constraint-color"
                            style={{ backgroundColor: group.color }}
                        />

                        <span className="constraint-name">{group.name}</span>

                        <span className="constraint-type">{getRuleLabels(group)}</span>
                    </div>
                ))
            )}
        </div>
    );
}