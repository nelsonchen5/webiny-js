import menus from "./crud/menus.crud";
import categories from "./crud/categories.crud";
import pages from "./crud/pages.crud";
import pageValidation from "./crud/pages.validation";
import pageElements from "./crud/pageElements.crud";
import settings from "./crud/settings.crud";
import system from "./crud/system.crud";
import { ContextPlugin } from "@webiny/handler/plugins/ContextPlugin";
import { PbContext } from "~/graphql/types";
import WebinyError from "@webiny/error";

const setup = () => {
    return new ContextPlugin<PbContext>(context => {
        if (context.pageBuilder) {
            throw new WebinyError("PbContext setup must be first loaded.", "CONTEXT_SETUP_ERROR");
        }
        context.pageBuilder = {} as any;
    });
};

export default [setup(), menus, categories, pages, pageValidation, pageElements, settings, system];
