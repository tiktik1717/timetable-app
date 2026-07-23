export default function SchedulingProgressPanel({ progress }) {
  const {
    totalHours = 0,
    placedHours = 0,
    remainingHours = 0,
    incompleteUnits = 0,
    percentage = 0,
  } = progress || {};

  let levelClass = "scheduling-progress-low";

  if (percentage >= 90) {
    levelClass = "scheduling-progress-high";
  } else if (percentage >= 70) {
    levelClass = "scheduling-progress-good";
  } else if (percentage >= 30) {
    levelClass = "scheduling-progress-medium";
  }

  return (
    <section className="scheduling-progress-panel" aria-label="התקדמות השיבוץ">
      <div className="scheduling-progress-heading">
        <h3>התקדמות השיבוץ</h3>
        <strong>{percentage}%</strong>
      </div>

      <div
        className="scheduling-progress-track"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow={percentage}
        aria-label={`${placedHours} מתוך ${totalHours} שעות שובצו`}
      >
        <div
          className={`scheduling-progress-fill ${levelClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="scheduling-progress-main">
        {placedHours} מתוך {totalHours} שעות שובצו
      </div>

      <div className="scheduling-progress-details">
        <span>נותרו: {remainingHours} שעות</span>
        <span>יחידות שטרם הושלמו: {incompleteUnits}</span>
      </div>
    </section>
  );
}
