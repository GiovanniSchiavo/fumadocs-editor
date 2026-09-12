export interface ContentFile {
  path: string;
  content: string;
}

export interface BinaryContentFile {
  path: string;
  bytes: Uint8Array;
}

export interface ContentProvider {
  read(path: string): Promise<ContentFile>;
  write(path: string, content: string): Promise<void>;
  readBinary?(path: string): Promise<BinaryContentFile>;
  writeBinary?(path: string, bytes: Uint8Array): Promise<void>;
  delete?(path: string): Promise<void>;
  list?(): Promise<string[]>;
}
