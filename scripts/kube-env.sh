# À charger depuis Bash : source scripts/kube-env.sh
# Le kubeconfig de laboratoire reste séparé de ~/.kube/config.
taskboard_repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
export PATH="$taskboard_repo/work/bin:$PATH"
export KUBECONFIG="$taskboard_repo/work/kubeconfig-taskboard-lab"
if [ -f "$KUBECONFIG" ]; then
  taskboard_context=$(kubectl config current-context)
  if [ "$taskboard_context" != 'kind-taskboard-lab' ]; then
    echo 'Contexte inattendu : aucun atelier ne doit viser un cluster externe.' >&2
    return 1
  fi
fi
