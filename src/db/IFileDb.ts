interface IFileDb<T> {
    csvFilePath: string;

    read(): T[];
    findRecord(identifier: keyof T, value: string): T | undefined;
}