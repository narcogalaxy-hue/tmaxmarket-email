const cron = require("node-cron");
const { createApp } = require("./app");

const PORT = process.env.PORT || 3000;

const app = createApp();

// Weekly seller report cron — every Monday at 9am (Europe/Rome)
cron.schedule(
  "0 9 * * 1",
  () => {
    console.log("[CRON] Weekly seller report trigger — Monday 9:00 AM");
    // In production this would fetch vendor data from the DB and call the report endpoint.
    // For MVP, the manual trigger endpoint POST /reports/trigger-weekly is the primary mechanism.
    console.log(
      "[CRON] Use POST /reports/trigger-weekly to send reports with data."
    );
  },
  { timezone: "Europe/Rome" }
);

app.listen(PORT, () => {
  console.log(`TmaxMarket.it email server running on port ${PORT}`);
  console.log("Cron: weekly report scheduled for Monday 9:00 AM (Europe/Rome)");
});
