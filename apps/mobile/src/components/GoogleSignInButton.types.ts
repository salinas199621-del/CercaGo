export interface GoogleSignInButtonProps {
  disabled?: boolean;
  onCredential(credential: string): void;
  onError(message: string): void;
}
