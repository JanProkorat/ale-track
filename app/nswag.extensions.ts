/* Extra declarations copied verbatim into src/generated/api-client.ts by NSwag.
 *
 * NSwag references FileParameter from every multipart operation it generates but only emits the
 * declaration for uploads described the Swagger 2 way, as a formData parameter. FastEndpoints
 * describes them the OpenAPI 3 way, as a requestBody, so the generated client compiled against a
 * type that was never written. Declaring it here keeps the fix in the generation step — the client
 * itself must never be hand-edited. */

export interface FileParameter {
    data: any;
    fileName: string;
}
