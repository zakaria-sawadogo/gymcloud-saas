#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Vérification post-déploiement — à lancer sur le VPS juste après
# chaque `docker compose up -d`, avant de considérer le déploiement
# terminé. N'est PAS une suite de tests automatisés (voir les tests
# jest du backend pour ça) — c'est un filet de sécurité rapide qui
# vérifie que les endpoints les plus critiques répondent, avec le bon
# code HTTP, juste après un déploiement.
#
# Utilisation : ./smoke-test.sh [URL_API]
#   URL_API par défaut : https://gymcloud.sahelsystem.com/api/v1
#
# Code de sortie : 0 si tout est vert, 1 si au moins un test échoue —
# utilisable dans un script d'automatisation plus tard.
# ═══════════════════════════════════════════════════════════════
set -uo pipefail

API_URL="${1:-https://gymcloud.sahelsystem.com/api/v1}"
SUPER_ADMIN_PHONE="+22600000000"
SUPER_ADMIN_PASSWORD="GymCloud@2026"

PASS=0
FAIL=0
FAILED_TESTS=()

# Couleurs (désactivées si pas un terminal)
if [ -t 1 ]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; NC='\033[0m'
else
  GREEN=''; RED=''; NC=''
fi

# check_status <libellé> <code_http_attendu> <méthode> <chemin> [token] [body_json]
check() {
  local label="$1" expected="$2" method="$3" path="$4" token="${5:-}" body="${6:-}"
  local auth_header=()
  [ -n "$token" ] && auth_header=(-H "Authorization: Bearer $token")

  local code
  if [ -n "$body" ]; then
    code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "${auth_header[@]}" \
      -H "Content-Type: application/json" -d "$body" "$API_URL$path")
  else
    code=$(curl -s -o /dev/null -w '%{http_code}' -X "$method" "${auth_header[@]}" "$API_URL$path")
  fi

  if [ "$code" = "$expected" ]; then
    echo -e "  ${GREEN}✓${NC} $label ($code)"
    PASS=$((PASS + 1))
  else
    echo -e "  ${RED}✗${NC} $label — attendu $expected, reçu $code"
    FAIL=$((FAIL + 1))
    FAILED_TESTS+=("$label")
  fi
}

echo "→ Vérification post-déploiement sur $API_URL"
echo ""
echo "Endpoints publics (site vitrine) :"
check "Plans publics"      200 GET "/public/plans"
check "Add-ons publics"    200 GET "/public/addons"
check "Pays publics"       200 GET "/public/countries"
check "Contact publics"    200 GET "/public/contact"

echo ""
echo "Connexion SUPER_ADMIN :"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$SUPER_ADMIN_PHONE\",\"password\":\"$SUPER_ADMIN_PASSWORD\"}")
TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

if [ -n "$TOKEN" ]; then
  echo -e "  ${GREEN}✓${NC} Connexion réussie, jeton obtenu"
  PASS=$((PASS + 1))
else
  echo -e "  ${RED}✗${NC} Connexion échouée — réponse : $LOGIN_RESPONSE"
  FAIL=$((FAIL + 1))
  FAILED_TESTS+=("Connexion SUPER_ADMIN")
fi

echo ""
if [ -n "$TOKEN" ]; then
  echo "Endpoints authentifiés (SUPER_ADMIN) :"
  check "Liste des salles"                  200 GET "/salles" "$TOKEN"
  check "Liste des propriétaires"           200 GET "/proprietaires" "$TOKEN"
  check "Personnel interne"                 200 GET "/internal-users" "$TOKEN"
  check "Rôles"                             200 GET "/roles" "$TOKEN"
  check "Plans SaaS"                        200 GET "/saas/plans" "$TOKEN"
  # §14.x — cet endpoint précis a cassé plusieurs fois cette session
  # (colonne/table manquante après une migration mal appliquée) — il
  # mérite sa propre vérification explicite.
  check "Validations en attente (facturation)" 200 GET "/saas/invoices/pending-validation" "$TOKEN"
else
  echo "Endpoints authentifiés : ignorés (pas de jeton — connexion échouée ci-dessus)"
fi

echo ""
echo "─────────────────────────────────────────"
echo -e "Résultat : ${GREEN}$PASS réussi(s)${NC}, ${RED}$FAIL échoué(s)${NC}"

if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Échecs à examiner :"
  for t in "${FAILED_TESTS[@]}"; do
    echo "  - $t"
  done
  echo ""
  echo "→ Vérifiez : docker compose logs api --tail 30"
  exit 1
fi

echo ""
echo "✓ Déploiement vérifié — tout répond correctement."
exit 0
