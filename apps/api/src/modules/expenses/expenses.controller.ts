import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PERMISSIONS } from '../../common/constants/permission.constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { CreateExpensePolicyDto } from './dto/create-expense-policy.dto';
import { ExpenseActionDto } from './dto/expense-action.dto';
import { ListExpensesDto } from './dto/list-expenses.dto';
import { ExpensesService } from './expenses.service';

@ApiTags('Expenses')
@ApiBearerAuth()
@Controller()
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post('expense-categories')
  @RequirePermissions(PERMISSIONS.EXPENSE_CATEGORIES_CREATE)
  @ApiOperation({ summary: 'Create expense category' })
  @ApiBody({ type: CreateExpenseCategoryDto })
  @ApiCreatedResponse({ description: 'Expense category created' })
  createCategory(
    @CurrentUser() user: Express.User,
    @Body() dto: CreateExpenseCategoryDto,
  ) {
    return this.expensesService.createCategory(user.tenantId, user, dto);
  }

  @Get('expense-categories')
  @RequirePermissions(PERMISSIONS.EXPENSE_CATEGORIES_READ)
  @ApiOperation({ summary: 'List expense categories' })
  @ApiOkResponse({ description: 'Expense category list' })
  listCategories(@CurrentUser() user: Express.User) {
    return this.expensesService.listCategories(user.tenantId);
  }

  @Post('expense-policies')
  @RequirePermissions(PERMISSIONS.EXPENSE_POLICIES_CREATE)
  @ApiOperation({ summary: 'Create or update expense policy' })
  @ApiBody({ type: CreateExpensePolicyDto })
  @ApiCreatedResponse({ description: 'Expense policy upserted' })
  createPolicy(@CurrentUser() user: Express.User, @Body() dto: CreateExpensePolicyDto) {
    return this.expensesService.createPolicy(user.tenantId, user, dto);
  }

  @Post('expenses')
  @RequirePermissions(PERMISSIONS.EXPENSES_CREATE)
  @ApiOperation({ summary: 'Create expense request' })
  @ApiBody({ type: CreateExpenseDto })
  @ApiCreatedResponse({ description: 'Expense request created' })
  createExpense(@CurrentUser() user: Express.User, @Body() dto: CreateExpenseDto) {
    return this.expensesService.createExpense(user.tenantId, user, dto);
  }

  @Get('expenses')
  @RequirePermissions(PERMISSIONS.EXPENSES_READ)
  @ApiOperation({ summary: 'List expenses' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @ApiQuery({ name: 'userId', required: false, example: 'cuid_user_1' })
  @ApiQuery({ name: 'projectId', required: false, example: 'cuid_project_1' })
  @ApiQuery({ name: 'categoryId', required: false, example: 'cuid_expense_category_1' })
  @ApiQuery({ name: 'from', required: false, example: '2026-07-01T00:00:00.000Z' })
  @ApiQuery({ name: 'to', required: false, example: '2026-07-31T00:00:00.000Z' })
  @ApiOkResponse({ description: 'Expense list' })
  listExpenses(@CurrentUser() user: Express.User, @Query() query: ListExpensesDto) {
    return this.expensesService.listExpenses(user.tenantId, user, query);
  }

  @Get('expenses/:id')
  @RequirePermissions(PERMISSIONS.EXPENSES_READ)
  @ApiOperation({ summary: 'Get expense by id' })
  @ApiParam({ name: 'id', example: 'cuid_expense_1' })
  @ApiOkResponse({ description: 'Expense details' })
  getExpense(@CurrentUser() user: Express.User, @Param('id') id: string) {
    return this.expensesService.getExpenseById(user.tenantId, user, id);
  }

  @Post('expenses/:id/approve')
  @RequirePermissions(PERMISSIONS.EXPENSES_APPROVE)
  @ApiOperation({ summary: 'Approve expense request' })
  @ApiParam({ name: 'id', example: 'cuid_expense_1' })
  @ApiBody({ type: ExpenseActionDto })
  @ApiOkResponse({ description: 'Expense request approved' })
  approveExpense(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: ExpenseActionDto,
  ) {
    return this.expensesService.approveExpense(user.tenantId, user, id, dto);
  }

  @Post('expenses/:id/reject')
  @RequirePermissions(PERMISSIONS.EXPENSES_REJECT)
  @ApiOperation({ summary: 'Reject expense request' })
  @ApiParam({ name: 'id', example: 'cuid_expense_1' })
  @ApiBody({ type: ExpenseActionDto })
  @ApiOkResponse({ description: 'Expense request rejected' })
  rejectExpense(
    @CurrentUser() user: Express.User,
    @Param('id') id: string,
    @Body() dto: ExpenseActionDto,
  ) {
    return this.expensesService.rejectExpense(user.tenantId, user, id, dto);
  }
}
