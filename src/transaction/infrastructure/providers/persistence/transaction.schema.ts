import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { TransactionStatus } from 'src/transaction/domain/transaction-status.enum';

@Schema({ collection: 'transactions', timestamps: true })
export class TransactionDocument extends Document {
  @Prop({ required: true, unique: true })
  id: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  currency: string;

  @Prop()
  description: string;

  @Prop({ required: true })
  receiverDocument: string;

  @Prop({ required: true })
  receiverDocumentType: string;

  @Prop()
  receiverName: string;

  @Prop({ required: true })
  receiverAccount: string;

  @Prop({ default: 'AHORROS' })
  receiverAccountType: string;

  @Prop({ required: true, type: String, enum: Object.values(TransactionStatus) })
  status: TransactionStatus;

  @Prop({ required: false })
  finalizedAt?: Date;

  @Prop({ required: true, default: () => new Date() })
  transactionDate: Date;
}

export const TransactionSchema =
  SchemaFactory.createForClass(TransactionDocument);
