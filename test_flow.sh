#!/bin/bash
TOKEN=$(curl -s -X POST http://localhost:3000/auth/register -H "Content-Type: application/json" -d '{"email":"demo@milquu.com","password":"password123","firstName":"Sudarshan","lastName":"Aher"}' | jq -r '.access_token')
echo "Token: $TOKEN"

ORG_ID=$(curl -s -X POST http://localhost:3000/organizations -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"name":"Milquu Workspace","slug":"milquu"}' | jq -r '.id')
echo "Org: $ORG_ID"

PROJECT_ID=$(curl -s -X POST http://localhost:3000/projects -H "Authorization: Bearer $TOKEN" -H "x-organization-id: $ORG_ID" -H "Content-Type: application/json" -d '{"name":"Sudarshan Aher","organizationId":"'$ORG_ID'"}' | jq -r '.id')
echo "Project: $PROJECT_ID"

WEBSITE_ID=$(curl -s -X POST http://localhost:3000/api/websites -H "Authorization: Bearer $TOKEN" -H "x-organization-id: $ORG_ID" -H "Content-Type: application/json" -d '{"url":"https://milquufresh.in","domain":"milquufresh.in","projectId":"'$PROJECT_ID'"}' | jq -r '.id')
echo "Website: $WEBSITE_ID"

curl -s -X POST http://localhost:3000/api/websites/$WEBSITE_ID/verify -H "Authorization: Bearer $TOKEN" -H "x-organization-id: $ORG_ID"
echo "Verified"
