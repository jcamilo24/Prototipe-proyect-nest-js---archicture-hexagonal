import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

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

  @Prop({ required: true })
  status: string;

  @Prop({ required: true, default: () => new Date() })
  transactionDate: Date;
}

export const TransactionSchema =
  SchemaFactory.createForClass(TransactionDocument);
