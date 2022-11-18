export function isRoomId (id: string): boolean {
  if (!id) return false
  return /^@@|@chatroom$/.test(id) // 以@@开头或者@chatroom结尾
}

export function isContactId (id: string): boolean {
  return !isRoomId(id)
}
