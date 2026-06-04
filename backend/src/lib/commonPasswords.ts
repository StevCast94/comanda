/**
 * S9 — Blacklist de contraseñas comunes.
 * Lista del top de contraseñas más usadas + términos propios del producto.
 * La comparación es case-insensitive y se normaliza quitando espacios.
 */
const COMMON_PASSWORDS = new Set<string>([
  "123456", "123456789", "12345678", "12345", "1234567", "1234567890",
  "password", "password1", "passw0rd", "qwerty", "qwerty123", "qwertyuiop",
  "abc123", "111111", "123123", "000000", "iloveyou", "1q2w3e4r",
  "admin", "administrator", "welcome", "welcome1", "monkey", "dragon",
  "letmein", "login", "princess", "solo", "master", "hello", "freedom",
  "whatever", "trustno1", "sunshine", "football", "baseball", "superman",
  "michael", "shadow", "ashley", "qazwsx", "654321", "555555", "666666",
  "777777", "888888", "121212", "1234", "12341234", "11111111",
  // Términos del producto (predecibles para esta app)
  "comanda", "comanda1", "comanda123", "restaurante", "restaurant",
  "comandaone", "comanda.one",
]);

/** Devuelve true si la contraseña está en la blacklist (no debe permitirse). */
export function isCommonPassword(password: string): boolean {
  return COMMON_PASSWORDS.has(password.trim().toLowerCase());
}
