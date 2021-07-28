import { GraphQLSchemaPlugin } from "@webiny/handler-graphql/plugins";
import { PbContext } from "@webiny/api-page-builder/types";
import { FormBuilderContext } from "@webiny/api-form-builder/types";
import { Response, ErrorResponse, NotFoundResponse } from "@webiny/handler-graphql/responses";

interface Context extends FormBuilderContext, PbContext {}

export default [
    new GraphQLSchemaPlugin({
        // Extend the `PbMutation` type with the `duplicatePage` mutation.
        typeDefs: /* GraphQL */ `
            extend type PbMutation {
                # Creates a copy of the provided page.
                duplicatePage(id: ID!): PbPageResponse
            }
        `,
        // In order for the `duplicatePage` to work, we also need to create a resolver function.
        resolvers: {
            PbMutation: {
                duplicatePage: async (_, args: { id: string }, context: Context) => {
                    // Retrieve the original page. If it doesn't exist, immediately exit.
                    const pageToDuplicate = await context.pageBuilder.pages.get(args.id);
                    if (!pageToDuplicate) {
                        return new NotFoundResponse("Page not found.");
                    }

                    try {
                        // We only need the `id` of the newly created page.
                        const newPage = await context.pageBuilder.pages.create(
                            pageToDuplicate.category
                        );

                        context.formBuilder.
                        // Set data that will be assigned to the newly created page.
                        const data = {
                            title: `Copy of ${pageToDuplicate.title}`,
                            path: `${pageToDuplicate.path}-copy-${new Date().getTime()}`,
                            content: pageToDuplicate.content,
                            settings: pageToDuplicate.settings
                        };

                        // Finally, update the newly created page.
                        const updatedNewPage = await context.pageBuilder.pages.update(
                            newPage.id,
                            data
                        );

                        return new Response(updatedNewPage);
                    } catch (e) {
                        return new ErrorResponse(e);
                    }
                }
            }
        }
    })
];
