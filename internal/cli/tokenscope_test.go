package cli

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFetchTokenScope_ReturnsRepoNames(t *testing.T) {
	github := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "/installation/repositories", r.URL.Path)
		assert.Equal(t, "100", r.URL.Query().Get("per_page"))
		assert.Equal(t, "Bearer ghs_test_token", r.Header.Get("Authorization"))

		json.NewEncoder(w).Encode(map[string]interface{}{
			"total_count": 2,
			"repositories": []map[string]string{
				{"full_name": "org-a/repo-one"},
				{"full_name": "org-a/repo-two"},
			},
		})
	}))
	defer github.Close()

	repos, err := fetchTokenScope("ghs_test_token", github.URL)
	require.NoError(t, err)
	assert.Equal(t, []string{"org-a/repo-one", "org-a/repo-two"}, repos)
}

func TestFetchTokenScope_EmptyToken(t *testing.T) {
	repos, err := fetchTokenScope("", "https://unused")
	require.NoError(t, err)
	assert.Nil(t, repos)
}

func TestFetchTokenScope_APIError(t *testing.T) {
	github := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
	}))
	defer github.Close()

	repos, err := fetchTokenScope("ghs_bad", github.URL)
	assert.Error(t, err)
	assert.Nil(t, repos)
}

func TestFetchTokenScope_NonInstallationToken(t *testing.T) {
	// Personal access tokens and GITHUB_TOKENs return 403 on
	// /installation/repositories. Treat as non-fatal.
	github := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
	}))
	defer github.Close()

	repos, err := fetchTokenScope("ghp_personal", github.URL)
	assert.Error(t, err)
	assert.Nil(t, repos)
}
