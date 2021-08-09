import { CliCommandScaffoldTemplate } from "@webiny/cli-plugin-scaffold/types";
import fs from "fs";
import path from "path";
import util from "util";
import ncpBase from "ncp";
import Case from "case";
import readJson from "load-json-file";
import writeJson from "write-json-file";
import { replaceInPath } from "replace-in-path";
import chalk from "chalk";
import link from "terminal-link";
import {
    formatCode,
    addWorkspaceToRootPackageJson,
    LAST_USED_GQL_API_PLUGINS_PATH
} from "@webiny/cli-plugin-scaffold/utils";
import execa from "execa";
import Error from "@webiny/error";
import { TsConfigJson } from "@webiny/cli-plugin-scaffold/types";

interface Input {
    name: string;
    description: string;
    path: string;
}

export const deployGraphQLAPI = (stack, env, inputs) =>
    execa("yarn", ["webiny", "deploy", stack, "--env", env, "--debug", Boolean(inputs.debug)], {
        stdio: "inherit"
    });

const ncp = util.promisify(ncpBase.ncp);

const SCAFFOLD_DOCS_LINK =
    "https://www.webiny.com/docs/how-to-guides/webiny-cli/scaffolding/new-graphql-api";

export default (): CliCommandScaffoldTemplate<Input> => ({
    name: "cli-plugin-scaffold-template-graphql-api",
    type: "cli-plugin-scaffold-template",
    scaffold: {
        name: "New GraphQL API",
        description:
            "Creates a GraphQL API powered by AWS Lambda and Amazon DynamoDB." +
            (link.isSupported ? " " + link("Learn more.", SCAFFOLD_DOCS_LINK) : ""),
        questions: () => {
            return [
                {
                    name: "name",
                    message: "Enter GraphQL API name:",
                    default: `My New GraphQL API`,
                    validate: name => {
                        if (name.length < 2) {
                            return `Please enter a name for your new GraphQL API.`;
                        }

                        return true;
                    }
                },
                {
                    name: "description",
                    message: "Enter description:",
                    default: input => {
                        return `This is the ${input.name} GraphQL API.`;
                    },
                    validate: description => {
                        if (description.length < 2) {
                            return `Please enter a short description for your new GraphQL API.`;
                        }

                        return true;
                    }
                },
                {
                    name: "path",
                    message: "Enter application path:",
                    default: input => {
                        return `${Case.kebab(input.name)}`;
                    },
                    validate: appPath => {
                        if (!appPath || appPath.length < 2) {
                            return `Please enter a valid path in which the new GraphQL API will be created.`;
                        }

                        const locationPath = path.resolve(appPath);
                        if (fs.existsSync(locationPath)) {
                            return `Cannot continue - the ${chalk.red(
                                appPath
                            )} folder already exists.`;
                        }

                        return true;
                    }
                }
            ];
        },
        generate: async options => {
            const { input, context, inquirer, wait, ora } = options;

            const templateFolderPath = path.join(__dirname, "template");

            console.log();
            console.log(
                `${chalk.bold("The following operations will be performed on your behalf:")}`
            );

            console.log(`- a new GraphQL API will be created in ${chalk.green(input.path)}`);
            console.log(
                `- the list of workspaces will be updated in the root ${chalk.green(
                    "package.json"
                )} file`
            );

            const prompt = inquirer.createPromptModule();

            const { proceed } = await prompt({
                name: "proceed",
                message: `Are you sure you want to continue?`,
                type: "confirm",
                default: false
            });

            if (!proceed) {
                process.exit(0);
            }
            console.log();

            ora.start(`Creating a new GraphQL API in ${chalk.green(input.path)}...`);
            await wait(1000);

            fs.mkdirSync(input.path, { recursive: true });

            await ncp(templateFolderPath, input.path);

            const replacements = [
                { find: "Project application name", replaceWith: input.name },
                { find: "Project application description", replaceWith: input.description },
                { find: "projectApplicationId", replaceWith: Case.camel(input.name) },
                { find: "project-application-id", replaceWith: Case.kebab(input.name) }
            ];

            replaceInPath(path.join(input.path, "/**/*.*"), replacements);

            const tsConfigJsonPath = path.join(input.path, "code", "graphql", "tsconfig.json");
            const tsConfigJson = await readJson<TsConfigJson>(tsConfigJsonPath);
            tsConfigJson.extends = path.join(
                path.relative(path.join(input.path, "code", "graphql"), context.project.root),
                "tsconfig.json"
            );
            await writeJson(tsConfigJsonPath, tsConfigJson);

            ora.stopAndPersist({
                symbol: chalk.green("✔"),
                text: `New GraphQL API created in ${chalk.green(input.path)}.`
            });

            ora.start(
                `Updating the list of workspaces in the root ${chalk.green("package.json")} file...`
            );
            await wait(1000);

            // Add package to workspaces.
            const rootPackageJsonPath = path.join(context.project.root, "package.json");
            const pathToAdd = `${input.path}/code/graphql`;
            await addWorkspaceToRootPackageJson(rootPackageJsonPath, pathToAdd);

            ora.stopAndPersist({
                symbol: chalk.green("✔"),
                text: `The list of workspaces in the root ${chalk.green(
                    "package.json"
                )} file updated.`
            });

            ora.start(`Finalizing...`);

            // Once everything is done, run `yarn` so the new packages are automatically installed.
            try {
                await execa("yarn");
                await execa("yarn", ["postinstall"]);
            } catch (err) {
                throw new Error(
                    `Unable to install dependencies. Try running "yarn" in project root manually.`,
                    err.message
                );
            }

            await formatCode(["**/*.ts", "**/*.tsx"], { cwd: input.path });

            ora.stopAndPersist({
                symbol: chalk.green("✔"),
                text: `Finalized.`
            });

            // Used in the Extend GraphQL API scaffold (auto filling the plugins folder path).
            context.localStorage.set(
                LAST_USED_GQL_API_PLUGINS_PATH,
                path.join(input.path, "code", "graphql", "src", "plugins")
            );

            await wait(500);
        },
        onSuccess: async ({ input, inquirer }) => {
            const prompt = inquirer.createPromptModule();

            // TODO app ?

            console.log();
            console.log(chalk.bold("Initial Deployment"));
            console.log(`To begin developing, the new GraphQL API needs to be deployed.`);

            const { deploy } = await prompt({
                name: "deploy",
                message: `Do you want to deploy it now?`,
                type: "confirm",
                default: true
            });

            console.log();

            if (deploy) {
                console.log(
                    `Running ${chalk.green(`yarn webiny deploy ${input.path}`)} command...`
                );
                console.log();
                await deployGraphQLAPI(input.path, "dev", input);
            }

            console.log(`${chalk.green("✔")} New GraphQL API created successfully.`);
            console.log();

            console.log(chalk.bold("Next Steps"));

            if (!deploy) {
                console.log(
                    `‣ deploy the new GraphQL API by running the ${chalk.green(
                        `yarn webiny deploy ${input.path} --env dev`
                    )} command`
                );
            }

            console.log(
                `‣ continue developing by running the ${chalk.green(
                    `yarn webiny watch ${input.path} --env dev`
                )} command`
            );

            console.log(
                `‣ start expanding your GraphQL API by running the ${chalk.green(
                    `yarn webiny scaffold`
                )} command again and selecting the Extend GraphQL API scaffold`
            );

            console.log();
            console.log(chalk.bold("Useful Links"));

            const links = [
                ["Create Custom Application Tutorial", SCAFFOLD_DOCS_LINK],
                ["New GraphQL API Scaffold", SCAFFOLD_DOCS_LINK],
                [
                    "Extend GraphQL API Scaffold",
                    "https://www.webiny.com/docs/how-to-guides/webiny-cli/scaffolding/extend-graphql-api"
                ],
                [
                    "Use the Watch Command",
                    "https://www.webiny.com/docs/how-to-guides/webiny-cli/use-watch-command"
                ]
            ];

            links.forEach(([text, url]) =>
                console.log(
                    link("‣ " + text, url, { fallback: (text, link) => text + " - " + link })
                )
            );
        }
    }
});