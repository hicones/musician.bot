export const isAdminUser = (userId: string): boolean => {
  const adminIds =
    process.env.ADMIN_USER_IDS?.split(",")
      .map((id) => id.trim())
      .filter(Boolean) || [];
  return adminIds.includes(userId);
};