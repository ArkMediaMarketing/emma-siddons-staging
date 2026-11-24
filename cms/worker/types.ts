/** Cloudflare bindings shared by the request handlers and local adapter. */
export interface StoredRow { [column:string]: any; }
export interface CmsStatement {
 bind(...values:unknown[]): CmsStatement;
 first<T = StoredRow>(): Promise<T|null>;
 all<T = StoredRow>(): Promise<{results:T[]}>;
 run(): Promise<{meta:{changes:number}}> ;
}
export interface CmsEnv {
 DB: {prepare(sql:string):CmsStatement; batch(statements:CmsStatement[]):Promise<unknown>};
 ASSETS: {fetch(request:Request):Promise<Response>};
 ADMIN_EMAIL:string;
 PUBLIC_SITE_ORIGIN?:string;
 LOCAL_DEVELOPMENT?:string;
}
