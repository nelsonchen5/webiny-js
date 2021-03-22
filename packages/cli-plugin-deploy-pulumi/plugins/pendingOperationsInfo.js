const MATCH_STRING = 'remove that operation from the "pending_operations" section of the file';
const { blue} = require("chalk");

module.exports = {
    type: "cli-command-error",
    handle: ({ context, error }) => {
        const { message } = error;
        const pendingOperationError = typeof message === "string" && message.includes(MATCH_STRING);
        if (!pendingOperationError) {
            return;
        }

        context.info(
            [
                `The ${blue(
                    "pending operations"
                )} Pulumi error you've just experienced can occur if one of the previous deployments has been interrupted, or another deployment is already in progress.`,
                "To learn more here, please visit https://docs.webiny.com/docs/how-to-guides/deployment/deploy-your-project#the-deploy-command."
            ].join(" ")
        );
    }
};