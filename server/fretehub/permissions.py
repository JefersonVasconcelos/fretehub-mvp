ROLE_PERMISSIONS = {
    "Administrador": {"*"},
    "Gestor de Logistica": {
        "read",
        "quote:create",
        "freight:select",
        "carrier:manage",
        "contract:manage",
        "tariff:manage",
        "integration:read",
        "audit:read",
        "import:create",
        "cost:read",
    },
    "Operador de Frete": {
        "read",
        "quote:create",
        "freight:select",
        "tariff:read",
        "carrier:read",
        "import:create",
        "cost:read",
    },
    "Financeiro": {"read", "cost:read", "audit:read"},
    "Consulta": {"read"},
}


def can(user, permission):
    permissions = set()
    for role in user.get("perfis") or [user.get("perfil")]:
        permissions.update(ROLE_PERMISSIONS.get(role, set()))
    return "*" in permissions or permission in permissions or (permission.endswith(":read") and "read" in permissions)


def permissions_for(user):
    values = set()
    for role in user.get("perfis") or [user.get("perfil")]:
        values.update(ROLE_PERMISSIONS.get(role, set()))
    return sorted(values)
