from django.contrib import admin
from .models import SolverResult

@admin.register(SolverResult)
class ControlUnitNameAdmin(admin.ModelAdmin):
    list_display = ("solve_date",)
    search_fields = ("solve_date",)
