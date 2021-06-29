import React, { useCallback, useEffect, useMemo, useRef } from "react";
import styled from "@emotion/styled";
import { Form, FormRenderPropParams } from "@webiny/form";
import { plugins } from "@webiny/plugins";
import { Cell, Grid } from "@webiny/ui/Grid";
import { CircularProgress } from "@webiny/ui/Progress";
import RenderFieldElement from "./RenderFieldElement";
import { CmsContentFormRendererPlugin, CmsEditorFieldRendererPlugin } from "~/types";
import { useContentEntryForm, UseContentEntryFormParams } from "./useContentEntryForm";

const FormWrapper = styled("div")({
    height: "calc(100vh - 260px)",
    overflow: "auto"
});

interface ContentEntryFormProps extends UseContentEntryFormParams {
    onForm?: (form: Form) => void;
}

export const ContentEntryForm = ({ onForm, ...props }: ContentEntryFormProps) => {
    const { contentModel } = props;
    const { loading, data, fields, onChange, onSubmit, invalidFields } = useContentEntryForm(props);

    // All form fields - an array of rows where each row is an array that contain fields.
    const ref = useRef(null);

    useEffect(() => {
        typeof onForm === "function" && onForm(ref.current);
    }, []);

    const renderPlugins = useMemo(
        () => plugins.byType<CmsEditorFieldRendererPlugin>("cms-editor-field-renderer"),
        []
    );

    const formRenderer = plugins
        .byType<CmsContentFormRendererPlugin>("cms-content-form-renderer")
        .find(pl => pl.modelId === contentModel.modelId);

    const renderDefaultLayout = useCallback(({ Bind }: FormRenderPropParams) => {
        return (
            <Grid>
                {fields.map((row, rowIndex) => (
                    <React.Fragment key={rowIndex}>
                        {row.map(field => (
                            <Cell span={Math.floor(12 / row.length)} key={field.id}>
                                <RenderFieldElement
                                    field={field}
                                    Bind={Bind}
                                    renderPlugins={renderPlugins}
                                    contentModel={contentModel}
                                />
                            </Cell>
                        ))}
                    </React.Fragment>
                ))}
            </Grid>
        );
    }, []);

    const renderCustomLayout = useCallback(
        (formRenderProps: FormRenderPropParams) => {
            const fields = contentModel.fields.reduce((acc, field) => {
                acc[field.fieldId] = (
                    <RenderFieldElement
                        field={field}
                        Bind={formRenderProps.Bind}
                        renderPlugins={renderPlugins}
                        contentModel={contentModel}
                    />
                );

                return acc;
            }, {});
            return formRenderer.render({ ...formRenderProps, contentModel, fields });
        },
        [formRenderer]
    );

    return (
        <Form
            onChange={onChange}
            onSubmit={onSubmit}
            data={data}
            ref={ref}
            invalidFields={invalidFields}
        >
            {formProps => (
                <FormWrapper data-testid={"cms-content-form"}>
                    {loading && <CircularProgress />}
                    {formRenderer ? renderCustomLayout(formProps) : renderDefaultLayout(formProps)}
                </FormWrapper>
            )}
        </Form>
    );
};