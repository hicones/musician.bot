export const formatError = (error: unknown): string => {
  if (error instanceof Error) {
    const code = (error as any).code || (error as any).errorCode;
    const codeText = code ? ` [${code}]` : '';
    return `${error.name}${codeText}: ${error.message}\n${error.stack || ''}`;
  }

  return String(error);
};
