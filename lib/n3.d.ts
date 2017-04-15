

declare namespace N3 {

    type ErrorCallback = (err: Error, result: any) => void;

    interface Dictionary {

    }

    interface Triple {
        subject: string,
        predicate: string,
        object: string
    }

    interface Output { 
        addTriple(subject: string, predicate: string, object: string): void;
        addTriple(triple: Triple): void;
        end(err: ErrorCallback, result?: any): void;
    }

    interface Options {
        format?: string,
        prefixes?: any
    }
    function Writer(options: Options): Output;
    function Writer(fd: any, options: Options): Output;

    interface StoreOutput extends Output {
        find(subject: string, predicate: string, object: string): Triple;
    }
    function Store(): StoreOutput;

    namespace Util {
        function createLiteral(value: any): string;
    }
}

declare module "n3" {
    export = N3;
}
