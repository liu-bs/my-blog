type TemplateParams = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

export function formatTemplate(template: string, params?: TemplateParams): string {
  if (!params) return template;
  return template.replace(PLACEHOLDER, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}
