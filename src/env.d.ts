/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    adminEntryPath?: string;
    _isInternalAdminRewrite?: boolean;
    isAdminAuthenticated?: boolean;
  }
}
