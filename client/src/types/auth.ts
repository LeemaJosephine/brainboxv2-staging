/** Platform role: Admin, team manager (manages one team), or user. */
export type PlatformRole = "admin" | "team_manager" | "user";

/** Role within a team: team manager vs member. */
export type TeamRole = "admin" | "member";

export interface User {
  _id: string;
  name: string;
  email: string;
  role?: PlatformRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface Membership {
  teamId: string;
  teamName: string;
  teamCode: string;
  role: TeamRole;
  status: "pending" | "active";
}

export interface SignupRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  membership?: Membership;
}

export interface MeResponse {
  user: User;
  membership?: Membership;
}
