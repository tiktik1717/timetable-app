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

                        <span className="constraint-type">
                            {group.type === "sameTime" ? "חייב ביחד" : "אסור ביחד"}
                        </span>
                    </div>
                ))
            )}
        </div>
    );
}