import cron from "node-cron";

const cronController = {
    keepServerAlive: () => {
        cron.schedule("*/12 * * * *", () => {
            console.log(`[CRON JOB] Server keep-alive executed at: ${new Date().toLocaleString()}`);
            
            // You can add additional logic here like hitting an API or executing a DB query
        }, {
            scheduled: true,
            timezone: "UTC" // Change to your timezone if needed
        });
    }
};

export default cronController;
