/**
 * Injection token for the public base URL used to compose full short links
 * (base + "/" + slug). Defined in its own file so the controller and the
 * module can both import it without creating a circular import between them.
 */
export const PUBLIC_BASE_URL_TOKEN = 'PUBLIC_BASE_URL';
