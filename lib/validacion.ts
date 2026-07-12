export type FieldErrors = Record<string, string>;

export type ValidationResult<T> = {
  ok: boolean;
  data?: T;
  errors: FieldErrors;
  message?: string;
};

function result<T>(data: T, errors: FieldErrors): ValidationResult<T> {
  const hasErrors = Object.keys(errors).length > 0;

  return {
    ok: !hasErrors,
    data,
    errors,
    message: hasErrors ? "Hay campos inválidos" : undefined,
  };
}

export function cleanString(value: unknown) {
  return String(value || "").trim();
}

export function cleanEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function cleanNumber(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : 0;
}

export function cleanInteger(value: unknown) {
  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? Math.trunc(numberValue) : 0;
}

export function cleanBoolean(value: unknown) {
  return Boolean(value);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPhone(value: string) {
  const phone = value.replace(/\D/g, "");

  return phone.length >= 8 && phone.length <= 15;
}

export function isValidUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

export function isValidUrlOrPath(value: string) {
  if (!value) return true;

  if (value.startsWith("/")) return true;

  try {
    const url = new URL(value);

    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function isValidDate(value: string) {
  if (!value) return false;

  const date = new Date(value);

  return !Number.isNaN(date.getTime());
}

export function isDateAfterOrEqual(date: string, minDate: string) {
  if (!isValidDate(date) || !isValidDate(minDate)) return false;

  return new Date(date).getTime() >= new Date(minDate).getTime();
}

export function isDateAfter(date: string, minDate: string) {
  if (!isValidDate(date) || !isValidDate(minDate)) return false;

  return new Date(date).getTime() > new Date(minDate).getTime();
}

export function validatePassword(value: string) {
  const password = cleanString(value);

  if (!password) return "La contraseña es obligatoria";
  if (password.length < 8) return "La contraseña debe tener mínimo 8 caracteres";
  if (!/[A-Z]/.test(password)) return "Debe incluir al menos una mayúscula";
  if (!/[a-z]/.test(password)) return "Debe incluir al menos una minúscula";
  if (!/[0-9]/.test(password)) return "Debe incluir al menos un número";

  return "";
}

/* =========================
   GIMNASIOS
========================= */

export type GymPayload = {
  name: string;
  phone: string;
  email: string;
  address: string;
  systemPlanId: string;
  adminFullName: string;
  adminEmail: string;
  adminPhone: string;
};

export function validateGymPayload(body: any): ValidationResult<GymPayload> {
  const data: GymPayload = {
    name: cleanString(body.name),
    phone: cleanString(body.phone),
    email: cleanEmail(body.email),
    address: cleanString(body.address),
    systemPlanId: cleanString(body.systemPlanId),
    adminFullName: cleanString(body.adminFullName),
    adminEmail: cleanEmail(body.adminEmail),
    adminPhone: cleanString(body.adminPhone),
  };

  const errors: FieldErrors = {};

  if (!data.name) errors.name = "El nombre del gimnasio es obligatorio";
  if (data.name.length < 3) errors.name = "El nombre debe tener mínimo 3 caracteres";

  if (!data.phone) errors.phone = "El teléfono del gimnasio es obligatorio";
  else if (!isValidPhone(data.phone)) errors.phone = "Teléfono inválido";

  if (!data.email) errors.email = "El correo del gimnasio es obligatorio";
  else if (!isValidEmail(data.email)) errors.email = "Correo inválido";

  if (!data.address) errors.address = "La dirección es obligatoria";

  if (!data.systemPlanId) errors.systemPlanId = "Debes seleccionar un plan";
  else if (!isValidUuid(data.systemPlanId)) errors.systemPlanId = "Plan inválido";

  if (!data.adminFullName) errors.adminFullName = "El nombre del administrador es obligatorio";
  if (!data.adminEmail) errors.adminEmail = "El correo del administrador es obligatorio";
  else if (!isValidEmail(data.adminEmail)) errors.adminEmail = "Correo del administrador inválido";

  if (!data.adminPhone) errors.adminPhone = "El teléfono del administrador es obligatorio";
  else if (!isValidPhone(data.adminPhone)) errors.adminPhone = "Teléfono del administrador inválido";

  return result(data, errors);
}

/* =========================
   PLANES DEL SAAS
========================= */

export type SystemPlanPayload = {
  name: string;
  code: string;
  monthlyFee: number;
  accessDays: number;
  description: string;
  features: string[];
  restrictions: string[];
  maxEmployees: number;
  maxMembers: number;
  maxProducts: number;
  canUseInventory: boolean;
  canUseSales: boolean;
  canUseAttendance: boolean;
  canUseReports: boolean;
  isActive: boolean;
};

export function validateSystemPlanPayload(
  body: any
): ValidationResult<SystemPlanPayload> {
  const data: SystemPlanPayload = {
    name: cleanString(body.name),
    code: cleanString(body.code).toUpperCase(),
    monthlyFee: cleanNumber(body.monthlyFee),
    accessDays: cleanInteger(body.accessDays),
    description: cleanString(body.description),
    features: Array.isArray(body.features) ? body.features.map(cleanString).filter(Boolean) : [],
    restrictions: Array.isArray(body.restrictions)
      ? body.restrictions.map(cleanString).filter(Boolean)
      : [],
    maxEmployees: cleanInteger(body.maxEmployees),
    maxMembers: cleanInteger(body.maxMembers),
    maxProducts: cleanInteger(body.maxProducts),
    canUseInventory: cleanBoolean(body.canUseInventory),
    canUseSales: cleanBoolean(body.canUseSales),
    canUseAttendance: cleanBoolean(body.canUseAttendance),
    canUseReports: cleanBoolean(body.canUseReports),
    isActive: body.isActive === undefined ? true : cleanBoolean(body.isActive),
  };

  const errors: FieldErrors = {};

  if (!data.name) errors.name = "El nombre del plan es obligatorio";
  if (!data.code) errors.code = "El código del plan es obligatorio";
  if (!/^[A-Z0-9_]+$/.test(data.code)) {
    errors.code = "El código solo puede llevar letras, números y guion bajo";
  }

  if (data.monthlyFee < 0) errors.monthlyFee = "La mensualidad no puede ser negativa";
  if (data.accessDays < 1) errors.accessDays = "Los días de acceso deben ser mayores a 0";

  if (data.maxEmployees < 0) errors.maxEmployees = "Máximo de empleados inválido";
  if (data.maxMembers < 0) errors.maxMembers = "Máximo de miembros inválido";
  if (data.maxProducts < 0) errors.maxProducts = "Máximo de productos inválido";

  return result(data, errors);
}

/* =========================
   USUARIOS DEL GIMNASIO
========================= */

export type GymUserPayload = {
  fullName: string;
  email: string;
  phone: string;
  role: "GYM_ADMIN" | "EMPLOYEE" | "MEMBER";
  status: "ACTIVE" | "INACTIVE";
};

export function validateGymUserPayload(body: any): ValidationResult<GymUserPayload> {
  const role = cleanString(body.role).toUpperCase();
  const status = cleanString(body.status || "ACTIVE").toUpperCase();

  const data: GymUserPayload = {
    fullName: cleanString(body.fullName),
    email: cleanEmail(body.email),
    phone: cleanString(body.phone),
    role: ["GYM_ADMIN", "EMPLOYEE", "MEMBER"].includes(role)
      ? (role as GymUserPayload["role"])
      : "MEMBER",
    status: ["ACTIVE", "INACTIVE"].includes(status)
      ? (status as GymUserPayload["status"])
      : "ACTIVE",
  };

  const errors: FieldErrors = {};

  if (!data.fullName) errors.fullName = "El nombre completo es obligatorio";
  else if (data.fullName.length < 3) errors.fullName = "El nombre debe tener mínimo 3 caracteres";

  if (!data.email) errors.email = "El correo es obligatorio";
  else if (!isValidEmail(data.email)) errors.email = "Correo inválido";

  if (!data.phone) errors.phone = "El teléfono es obligatorio";
  else if (!isValidPhone(data.phone)) errors.phone = "Teléfono inválido";

  if (!["GYM_ADMIN", "EMPLOYEE", "MEMBER"].includes(data.role)) {
    errors.role = "Rol inválido";
  }

  if (!["ACTIVE", "INACTIVE"].includes(data.status)) {
    errors.status = "Estado inválido";
  }

  return result(data, errors);
}

/* =========================
   PRODUCTOS
========================= */

export type ProductPayload = {
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  status: "ACTIVE" | "INACTIVE";
};

export function validateProductPayload(body: any): ValidationResult<ProductPayload> {
  const status = cleanString(body.status || "ACTIVE").toUpperCase();

  const data: ProductPayload = {
    name: cleanString(body.name),
    description: cleanString(body.description),
    imageUrl: cleanString(body.imageUrl),
    price: cleanNumber(body.price),
    status: ["ACTIVE", "INACTIVE"].includes(status)
      ? (status as ProductPayload["status"])
      : "ACTIVE",
  };

  const errors: FieldErrors = {};

  if (!data.name) errors.name = "El nombre del producto es obligatorio";
  if (data.price < 0) errors.price = "El precio no puede ser negativo";

  if (data.imageUrl && !isValidUrlOrPath(data.imageUrl)) {
    errors.imageUrl = "La imagen debe ser una URL válida o una ruta como /images/producto.png";
  }

  return result(data, errors);
}

/* =========================
   INVENTARIO
========================= */

export type InventoryPayload = {
  productId: string;
  stock: number;
  stockEntryDate: string;
  movementType: "IN" | "OUT" | "ADJUSTMENT";
  quantity: number;
  note: string;
};

export function validateInventoryPayload(body: any): ValidationResult<InventoryPayload> {
  const movementType = cleanString(body.movementType).toUpperCase();

  const data: InventoryPayload = {
    productId: cleanString(body.productId),
    stock: cleanInteger(body.stock),
    stockEntryDate: cleanString(body.stockEntryDate),
    movementType: ["IN", "OUT", "ADJUSTMENT"].includes(movementType)
      ? (movementType as InventoryPayload["movementType"])
      : "ADJUSTMENT",
    quantity: cleanInteger(body.quantity),
    note: cleanString(body.note),
  };

  const errors: FieldErrors = {};

  if (!data.productId) errors.productId = "El producto es obligatorio";
  else if (!isValidUuid(data.productId)) errors.productId = "Producto inválido";

  if (data.stock < 0) errors.stock = "El stock no puede ser negativo";

  if (data.stockEntryDate && !isValidDate(data.stockEntryDate)) {
    errors.stockEntryDate = "Fecha de ingreso inválida";
  }

  if (data.quantity < 0) errors.quantity = "La cantidad no puede ser negativa";

  return result(data, errors);
}

/* =========================
   VENTAS
========================= */

export type SaleItemPayload = {
  productId: string;
  quantity: number;
  unitPrice: number;
};

export type SalePayload = {
  items: SaleItemPayload[];
  paymentMethod: string;
  customerName: string;
  note: string;
};

export function validateSalePayload(body: any): ValidationResult<SalePayload> {
  const items = Array.isArray(body.items) ? body.items : [];

  const data: SalePayload = {
    items: items.map((item: any) => ({
      productId: cleanString(item.productId),
      quantity: cleanInteger(item.quantity),
      unitPrice: cleanNumber(item.unitPrice),
    })),
    paymentMethod: cleanString(body.paymentMethod || "EFECTIVO"),
    customerName: cleanString(body.customerName),
    note: cleanString(body.note),
  };

  const errors: FieldErrors = {};

  if (data.items.length === 0) {
    errors.items = "Debes agregar al menos un producto";
  }

  data.items.forEach((item, index) => {
    if (!item.productId || !isValidUuid(item.productId)) {
      errors[`items.${index}.productId`] = "Producto inválido";
    }

    if (item.quantity <= 0) {
      errors[`items.${index}.quantity`] = "La cantidad debe ser mayor a 0";
    }

    if (item.unitPrice < 0) {
      errors[`items.${index}.unitPrice`] = "El precio no puede ser negativo";
    }
  });

  return result(data, errors);
}

/* =========================
   MEMBRESÍAS
========================= */

export type MembershipPlanPayload = {
  name: string;
  price: number;
  durationDays: number;
  description: string;
  isActive: boolean;
};

export function validateMembershipPlanPayload(
  body: any
): ValidationResult<MembershipPlanPayload> {
  const data: MembershipPlanPayload = {
    name: cleanString(body.name),
    price: cleanNumber(body.price),
    durationDays: cleanInteger(body.durationDays),
    description: cleanString(body.description),
    isActive: body.isActive === undefined ? true : cleanBoolean(body.isActive),
  };

  const errors: FieldErrors = {};

  if (!data.name) errors.name = "El nombre de la membresía es obligatorio";
  if (data.price < 0) errors.price = "El precio no puede ser negativo";
  if (data.durationDays <= 0) errors.durationDays = "La duración debe ser mayor a 0 días";

  return result(data, errors);
}

export type AssignMembershipPayload = {
  userId: string;
  membershipPlanId: string;
  startDate: string;
  endDate: string;
};

export function validateAssignMembershipPayload(
  body: any
): ValidationResult<AssignMembershipPayload> {
  const data: AssignMembershipPayload = {
    userId: cleanString(body.userId),
    membershipPlanId: cleanString(body.membershipPlanId),
    startDate: cleanString(body.startDate),
    endDate: cleanString(body.endDate),
  };

  const errors: FieldErrors = {};

  if (!data.userId || !isValidUuid(data.userId)) errors.userId = "Usuario inválido";
  if (!data.membershipPlanId || !isValidUuid(data.membershipPlanId)) {
    errors.membershipPlanId = "Plan de membresía inválido";
  }

  if (!data.startDate || !isValidDate(data.startDate)) {
    errors.startDate = "Fecha de inicio inválida";
  }

  if (!data.endDate || !isValidDate(data.endDate)) {
    errors.endDate = "Fecha final inválida";
  }

  if (
    data.startDate &&
    data.endDate &&
    isValidDate(data.startDate) &&
    isValidDate(data.endDate) &&
    !isDateAfter(data.endDate, data.startDate)
  ) {
    errors.endDate = "La fecha final debe ser posterior a la fecha de inicio";
  }

  return result(data, errors);
}

/* =========================
   PAGOS
========================= */

export type PaymentPayload = {
  userId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  note: string;
};

export function validatePaymentPayload(body: any): ValidationResult<PaymentPayload> {
  const data: PaymentPayload = {
    userId: cleanString(body.userId),
    amount: cleanNumber(body.amount),
    paymentMethod: cleanString(body.paymentMethod || "EFECTIVO"),
    paymentDate: cleanString(body.paymentDate),
    note: cleanString(body.note),
  };

  const errors: FieldErrors = {};

  if (!data.userId || !isValidUuid(data.userId)) errors.userId = "Usuario inválido";
  if (data.amount <= 0) errors.amount = "El monto debe ser mayor a 0";

  if (!data.paymentDate || !isValidDate(data.paymentDate)) {
    errors.paymentDate = "Fecha de pago inválida";
  }

  return result(data, errors);
}

/* =========================
   QR ASISTENCIA
========================= */

export type QrAttendancePayload = {
  token: string;
};

export function extractQrToken(value: unknown) {
  const cleanValue = cleanString(value);

  if (!cleanValue) return "";

  try {
    const url = new URL(cleanValue);
    return url.searchParams.get("token") || "";
  } catch {
    const match = cleanValue.match(/[?&]token=([^&]+)/);

    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }

    return cleanValue;
  }
}

export function validateQrAttendancePayload(
  body: any
): ValidationResult<QrAttendancePayload> {
  const token = extractQrToken(body.token);

  const data: QrAttendancePayload = {
    token,
  };

  const errors: FieldErrors = {};

  if (!data.token) errors.token = "El token del QR es obligatorio";
  else if (data.token.length < 20) errors.token = "El token del QR parece incompleto";
  else if (!/^[a-zA-Z0-9_-]+$/.test(data.token)) {
    errors.token = "El token del QR contiene caracteres inválidos";
  }

  return result(data, errors);
}

/* =========================
   LOGIN / CONTRASEÑA
========================= */

export type LoginPayload = {
  username: string;
  password: string;
};

export function validateLoginPayload(body: any): ValidationResult<LoginPayload> {
  const data: LoginPayload = {
    username: cleanString(body.username),
    password: cleanString(body.password),
  };

  const errors: FieldErrors = {};

  if (!data.username) errors.username = "El usuario es obligatorio";
  if (!data.password) errors.password = "La contraseña es obligatoria";

  return result(data, errors);
}

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function validateChangePasswordPayload(
  body: any
): ValidationResult<ChangePasswordPayload> {
  const data: ChangePasswordPayload = {
    currentPassword: cleanString(body.currentPassword),
    newPassword: cleanString(body.newPassword),
    confirmPassword: cleanString(body.confirmPassword),
  };

  const errors: FieldErrors = {};

  if (!data.currentPassword) errors.currentPassword = "La contraseña actual es obligatoria";

  const passwordError = validatePassword(data.newPassword);

  if (passwordError) errors.newPassword = passwordError;

  if (!data.confirmPassword) {
    errors.confirmPassword = "Confirma la nueva contraseña";
  } else if (data.newPassword !== data.confirmPassword) {
    errors.confirmPassword = "Las contraseñas no coinciden";
  }

  return result(data, errors);
}