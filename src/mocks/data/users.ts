import type { User } from "@/features/auth/types";

/**
 * Demo accounts for the mock API only. Passwords live exclusively in the mock
 * layer and never reach Redux or browser storage.
 */
export interface MockUserRecord {
  user: User;
  password: string;
}

export const MOCK_USERS: MockUserRecord[] = [
  {
    password: "eBudget@2026",
    user: {
      id: "usr-001",
      employeeId: "MPC-2019-0142",
      firstName: "Juan",
      lastName: "Dela Cruz",
      email: "juan.delacruz@mpc.edu.ph",
      phone: "+63 917 555 0142",
      position: "Budget Officer III",
      office: "Budget Office",
      agency: "Marikina Polytechnic College",
      role: "budget_officer",
      createdAt: "2019-06-03T08:00:00.000Z",
    },
  },
  {
    password: "eBudget@2026",
    user: {
      id: "usr-004",
      employeeId: "MPC-2015-0031",
      firstName: "Ana",
      lastName: "Villanueva",
      email: "ana.villanueva@mpc.edu.ph",
      phone: "+63 917 555 0031",
      position: "Budget Officer V",
      office: "Budget Office",
      agency: "Marikina Polytechnic College",
      role: "budget_head",
      createdAt: "2015-08-10T08:00:00.000Z",
    },
  },
  {
    password: "eBudget@2026",
    user: {
      id: "usr-002",
      employeeId: "MPC-2017-0088",
      firstName: "Maria",
      lastName: "Santos",
      email: "maria.santos@mpc.edu.ph",
      phone: "+63 918 555 0088",
      position: "Accountant IV",
      office: "Accounting Office",
      agency: "Marikina Polytechnic College",
      role: "accountant",
      createdAt: "2017-02-14T08:00:00.000Z",
    },
  },
  {
    password: "eBudget@2026",
    user: {
      id: "usr-003",
      employeeId: "MPC-2012-0007",
      firstName: "Antonio",
      lastName: "Reyes",
      email: "antonio.reyes@mpc.edu.ph",
      phone: "+63 919 555 0007",
      position: "College President",
      office: "Office of the President",
      agency: "Marikina Polytechnic College",
      role: "head_of_agency",
      createdAt: "2012-07-01T08:00:00.000Z",
    },
  },
];
