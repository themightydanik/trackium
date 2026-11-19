# Railway source deployment verification

When validating the Railway GitHub source connection, verify the Git commit SHA shown in the deployment details. The fetched build snapshot digest identifies the archived build context; it is not the Git commit SHA.

For this repository, the HTTP/TCP listener separation change is included in commit `030d57c0c2bd7392b5ae7645fd184ffc7dd5157e` on `main` (PR #37). A deployment intended to test that change must report that commit or a descendant of it as its source commit.

Do not change the production TCP proxy or listener port settings as part of source-connection diagnostics.
