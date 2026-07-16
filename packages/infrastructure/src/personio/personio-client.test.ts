import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PersonioClient } from "./personio-client.js";

function authBody(token = "tok-123") {
  return { success: true, data: { token } };
}

function employeeAttrs(overrides: Partial<{ id: number; email: string; status: string }> = {}) {
  return {
    id: { value: overrides.id ?? 1 },
    first_name: { value: "Sina" },
    last_name: { value: "Strathemann" },
    email: { value: overrides.email ?? "sina@example.com" },
    status: { value: overrides.status ?? "active" },
    employment_type: { value: "internal" },
    department: { value: { attributes: { name: { value: "IT" } } } },
    position: { value: "Consultant" },
    office: { value: { attributes: { name: { value: "Münster" } } } },
    hire_date: { value: "2020-01-01" },
  };
}

function employeesBody(attrsList: ReturnType<typeof employeeAttrs>[]) {
  return {
    success: true,
    data: attrsList.map((attributes) => ({ type: "Employee" as const, attributes })),
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PersonioClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("caches the auth token: two listEmployees() calls only trigger one /auth call", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(authBody()))
      .mockResolvedValueOnce(jsonResponse(employeesBody([employeeAttrs()])))
      .mockResolvedValueOnce(jsonResponse(employeesBody([employeeAttrs()])));

    const client = new PersonioClient("id", "secret", "https://api.personio.de/v1");
    await client.listEmployees();
    await client.listEmployees();

    const authCalls = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth"));
    expect(authCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3); // 1x auth + 2x employees
  });

  it("parses the employee list and unwraps .value attributes (active + inactive)", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(authBody()))
      .mockResolvedValueOnce(
        jsonResponse(
          employeesBody([
            employeeAttrs({ id: 1, status: "active", email: "active@mindsquare.de" }),
            employeeAttrs({ id: 2, status: "inactive", email: "inactive@mindsquare.de" }),
          ]),
        ),
      );

    const client = new PersonioClient("id", "secret", "https://api.personio.de/v1");
    const employees = await client.listEmployees();

    expect(employees).toHaveLength(2);
    expect(employees[0]).toMatchObject({
      id: "1",
      email: "active@mindsquare.de",
      status: "active",
      department: "IT",
      office: "Münster",
      position: "Consultant",
    });
    expect(employees[1]).toMatchObject({
      id: "2",
      email: "inactive@mindsquare.de",
      status: "inactive",
    });
  });

  it("throws when the auth request fails", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "invalid credentials" }, 401));

    const client = new PersonioClient("id", "bad-secret", "https://api.personio.de/v1");
    await expect(client.listEmployees()).rejects.toThrow(/Personio auth failed: 401/);
  });
});
