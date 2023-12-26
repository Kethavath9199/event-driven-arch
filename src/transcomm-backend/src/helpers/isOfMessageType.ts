export function isOfMessageType(
  allowedMessageTypes: string | undefined,
  inputMessageType: string,
): boolean {
  if (!allowedMessageTypes) return false;
  console.log('env.....# ',allowedMessageTypes)
  return allowedMessageTypes
    .split(',')
    .map((msgType: string) => msgType.trim())
    .includes(inputMessageType.trim());
}
